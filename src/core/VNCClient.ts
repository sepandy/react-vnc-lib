import {
  VNCClientOptions,
  VNCConnectionState,
  VNCEvent,
  VNCEventHandler,
  VNCKeyEvent,
  VNCPointerEvent,
  VNCServerInitMessage,
  VNCPixelFormat
} from '../types/vnc';
import { VNCProtocolUtils } from '../utils/protocol';

export class VNCClient {
  private ws: WebSocket | null = null;
  private options: Required<VNCClientOptions>;
  private state: VNCConnectionState;
  private eventHandlers: Map<string, VNCEventHandler[]> = new Map();
  private serverInit: VNCServerInitMessage | null = null;
  private pixelFormat: VNCPixelFormat;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private vncState: 'version' | 'security' | 'auth' | 'init' | 'connected' = 'version';
  
  constructor(options: VNCClientOptions) {
    this.options = {
      url: options.url,
      username: options.username || '',
      password: options.password || '',
      viewOnly: options.viewOnly || false,
      quality: options.quality || 6,
      compression: options.compression || 2,
      autoResize: options.autoResize || true,
      scale: options.scale || 1.0,
      timeout: options.timeout || 10000,
      debug: options.debug || false
    };

    this.state = {
      connected: false,
      connecting: false,
      error: null,
      serverName: null,
      width: 0,
      height: 0
    };

    this.pixelFormat = VNCProtocolUtils.getDefaultPixelFormat();
    
  }

  /**
   * Connect to VNC server
   */
  async connect(): Promise<void> {
    if (this.state.connecting || this.state.connected) {
      throw new Error('Already connecting or connected');
    }

    // Clean up any existing connection state before reconnecting
    this.cleanupExistingConnection();

    this.setState({ connecting: true, error: null });
    this.vncState = 'version'; // Reset VNC protocol state
    this.emit('connecting');

    try {
      // Validate URL
      if (!this.isValidWebSocketUrl(this.options.url)) {
        throw new Error('Invalid WebSocket URL');
      }

      this.log('Attempting to connect to:', this.options.url);
      
      // Standard WebSocket connection for VNC over WebSocket
      this.ws = new WebSocket(this.options.url);
      this.ws.binaryType = 'arraybuffer';

      this.setupWebSocketHandlers();
      this.setupConnectionTimeout();

      return new Promise((resolve, reject) => {
        const onConnected = () => {
          this.off('connected', onConnected);
          this.off('error', onError);
          this.reconnectAttempts = 0; // Reset on successful connection
          resolve();
        };

        const onError = (event: VNCEvent) => {
          this.off('connected', onConnected);
          this.off('error', onError);
          reject(new Error(event.data?.message || 'Connection failed'));
        };

        this.on('connected', onConnected);
        this.on('error', onError);
      });
    } catch (error) {
      this.setState({ connecting: false, error: (error as Error).message });
      this.emit('error', { message: (error as Error).message });
      throw error;
    }
  }

  /**
   * Validate WebSocket URL
   */
  private isValidWebSocketUrl(url: string): boolean {
    try {
      const wsUrl = new URL(url);
      return wsUrl.protocol === 'ws:' || wsUrl.protocol === 'wss:';
    } catch {
      return false;
    }
  }

  /**
   * Disconnect from VNC server
   */
  disconnect(): void {
    this.log('Disconnecting...');
    
    // Reset reconnection attempts and VNC state
    this.reconnectAttempts = 0;
    this.vncState = 'version';
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.ws) {
      // Clean up event handlers to prevent reconnection attempts
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }

    this.setState({
      connected: false,
      connecting: false,
      error: null,
      serverName: null,
      width: 0,
      height: 0
    });

    this.emit('disconnected');
  }

  /**
   * Reset reconnection attempts (useful for manual retry)
   */
  resetReconnectionAttempts(): void {
    this.reconnectAttempts = 0;
    this.log('Reconnection attempts reset');
  }

  /**
   * Send key event
   */
  sendKeyEvent(event: VNCKeyEvent): void {
    if (!this.state.connected || this.options.viewOnly) return;

    // All connections use standard VNC key events
    const keyCode = this.keyToVNCKey(event.key, event.code);
    const message = VNCProtocolUtils.createKeyEvent(event.down, keyCode);
    this.sendMessage(message);
  }

  /**
   * Send pointer event
   */
  sendPointerEvent(event: VNCPointerEvent): void {
    if (!this.state.connected || this.options.viewOnly) return;

    // All connections use standard VNC pointer events
    const message = VNCProtocolUtils.createPointerEvent(
      event.buttons,
      Math.floor(event.x / this.options.scale),
      Math.floor(event.y / this.options.scale)
    );
    this.sendMessage(message);
  }

  /**
   * Request framebuffer update
   */
  requestFramebufferUpdate(incremental: boolean = true): void {
    if (!this.state.connected) return;

    const message = VNCProtocolUtils.createFramebufferUpdateRequest(
      incremental,
      0,
      0,
      this.state.width,
      this.state.height
    );
    this.sendMessage(message);
  }

  /**
   * Get current connection state
   */
  getState(): VNCConnectionState {
    return { ...this.state };
  }

  /**
   * Add event listener
   */
  on(event: string, handler: VNCEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: VNCEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(type: string, data?: any): void {
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      const event: VNCEvent = { type: type as any, data };
      handlers.forEach(handler => handler(event));
    }

    if (this.options.debug) {
      console.log(`[VNC] Event: ${type}`, data);
    }
  }

  /**
   * Update internal state
   */
  private setState(newState: Partial<VNCConnectionState>): void {
    this.state = { ...this.state, ...newState };
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.log('WebSocket opened successfully');
      this.handleConnectionOpen();
    };

    this.ws.onmessage = (event) => {
      this.handleServerMessage(event.data);
    };

    this.ws.onclose = (event) => {
      this.log('WebSocket closed', event.code, event.reason);
      this.handleConnectionClose(event);
    };

    this.ws.onerror = (event) => {
      this.log('WebSocket error', event);
      this.handleConnectionError(event);
    };
  }

  /**
   * Handle successful WebSocket connection
   */
  private handleConnectionOpen(): void {
    this.log('WebSocket connection opened, waiting for server version');
    this.vncState = 'version';
    // Wait for server to send its version string first (per VNC protocol)
    // Don't send anything yet - server goes first
  }

  /**
   * Handle WebSocket connection close
   */
  private handleConnectionClose(event: CloseEvent): void {
    const wasConnected = this.state.connected;
    this.setState({ connected: false, connecting: false });
    
    // Provide meaningful error messages based on close code
    let errorMessage = '';
    switch (event.code) {
      case 1000:
        this.log('Connection closed normally');
        break;
      case 1006:
        errorMessage = 'Connection lost unexpectedly. Server may be unreachable or token expired.';
        break;
      case 1002:
        errorMessage = 'Protocol error. Server rejected the connection.';
        break;
      case 1003:
        errorMessage = 'Server rejected connection due to invalid data.';
        break;
      case 1008:
        errorMessage = 'Connection rejected by policy (CORS, authentication, etc.)';
        break;
      case 1011:
        errorMessage = 'Server encountered an unexpected error.';
        break;
      default:
        errorMessage = `Connection closed with code ${event.code}: ${event.reason || 'Unknown reason'}`;
    }

    if (errorMessage) {
      this.log('Connection error:', errorMessage);
      this.setState({ error: errorMessage });
      this.emit('error', { message: errorMessage });
    }

    this.emit('disconnected');

    // Attempt reconnection for certain error codes if it was a working connection
    if (wasConnected && this.shouldAttemptReconnect(event.code)) {
      this.log(`Connection lost (code ${event.code}), attempting reconnection...`);
      this.attemptReconnect();
    } else if (this.reconnectAttempts > 0) {
      // If this was a reconnection attempt that failed, provide specific feedback
      this.log(`Reconnection attempt ${this.reconnectAttempts} failed with code ${event.code}. ${
        event.code === 1003 ? 'This may indicate protocol state issues or server rejection.' : ''
      }`);
      
      // Reset reconnection attempts after certain failures to prevent endless loops
      if (event.code === 1003 || event.code === 1002) {
        this.log('Resetting reconnection attempts due to protocol error');
        this.reconnectAttempts = this.maxReconnectAttempts; // Stop further attempts
      }
    }
  }

  /**
   * Handle WebSocket errors
   */
  private handleConnectionError(event: Event): void {
    this.log('WebSocket error details:', event);
    
    let message = 'WebSocket connection error';
    
    // Try to get more specific error information
    if (event instanceof ErrorEvent) {
      message = `WebSocket error: ${event.message}`;
    } else if (event.type === 'error') {
      message = 'WebSocket connection failed. Check network connectivity and server availability.';
    }
    
    this.setState({ connecting: false, connected: false, error: message });
    this.emit('error', { message });
  }

  /**
   * Check if we should attempt reconnection
   */
  private shouldAttemptReconnect(closeCode: number): boolean {
    // Only attempt reconnection for specific error codes and within limits
    const retryableCodes = [1006]; // Connection lost unexpectedly
    return retryableCodes.includes(closeCode) && this.reconnectAttempts < this.maxReconnectAttempts;
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000); // Exponential backoff
    
    this.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.state.connected && !this.state.connecting) {
        this.log('Starting reconnection attempt...');
        this.connect().catch(error => {
          this.log('Reconnection failed:', error.message);
          // The error will be handled by handleConnectionClose if it's a WebSocket close event
        });
      } else {
        this.log('Skipping reconnection - already connected or connecting');
      }
    }, delay);
  }

  /**
   * Setup connection timeout
   */
  private setupConnectionTimeout(): void {
    this.connectionTimeout = setTimeout(() => {
      if (this.state.connecting) {
        this.disconnect();
        const message = 'Connection timeout';
        this.setState({ error: message });
        this.emit('error', { message });
      }
    }, this.options.timeout);
  }

  /**
   * Handle VNC protocol version handshake
   */
  private handleProtocolVersion(): void {
    // This method is now only called when we receive server's version
    // and we need to respond with our version
    this.log('Responding to server with VNC protocol version');
    // VNC protocol version 3.8
    const version = 'RFB 003.008\n';
    this.sendRawMessage(version);
  }

  /**
   * Handle server messages based on VNC protocol state
   */
  private handleServerMessage(data: ArrayBuffer): void {
    this.log(`Received message in state '${this.vncState}', length: ${data.byteLength}`);
    
    try {
      switch (this.vncState) {
        case 'version':
          this.handleVersionResponse(data);
          break;
        case 'security':
          this.handleSecurityResponse(data);
          break;
        case 'auth':
          this.handleAuthResponse(data);
          break;
        case 'init':
          this.handleServerInit(data);
          break;
        case 'connected':
          this.handleProtocolMessage(data);
          break;
        default:
          this.log('Unexpected VNC state:', this.vncState);
      }
    } catch (error) {
      this.log('Error handling server message:', error);
      this.emit('error', { message: `Protocol error: ${(error as Error).message}` });
    }
  }

  /**
   * Handle version response from server
   */
  private handleVersionResponse(data: ArrayBuffer): void {
    if (data.byteLength >= 12) {
      const response = new TextDecoder().decode(data);
      this.log('Received server version:', response.trim());
      
      // Now respond with our version
      this.handleProtocolVersion();
      
      this.vncState = 'security';
      // Server will send security types next
    }
  }

  /**
   * Handle security types from server
   */
  private handleSecurityResponse(data: ArrayBuffer): void {
    if (data.byteLength >= 2) {
      const view = new DataView(data);
      const numSecTypes = view.getUint8(0);
      
      if (numSecTypes === 0) {
        // Security handshake failed
        const reasonLength = view.getUint32(1, false);
        if (data.byteLength >= 5 + reasonLength) {
          const reason = new TextDecoder().decode(new Uint8Array(data, 5, reasonLength));
          throw new Error(`Security handshake failed: ${reason}`);
        }
        throw new Error('Security handshake failed: Unknown reason');
      }

      // Look for VNC authentication (type 2) or None (type 1)
      const secTypes: number[] = [];
      for (let i = 0; i < numSecTypes; i++) {
        if (data.byteLength > 1 + i) {
          secTypes.push(view.getUint8(1 + i));
        }
      }

      this.log('Available security types:', secTypes);

      let chosenSecType = 1; // None by default
      if (this.options.password && secTypes.includes(2)) {
        chosenSecType = 2; // VNC Authentication
        this.log('Using VNC authentication');
      } else if (secTypes.includes(1)) {
        chosenSecType = 1; // None
        this.log('Using no authentication');
      } else {
        throw new Error('No supported security type available');
      }

      // Send chosen security type
      const response = new ArrayBuffer(1);
      new DataView(response).setUint8(0, chosenSecType);
      this.sendMessage(response);

      if (chosenSecType === 2) {
        this.vncState = 'auth';
      } else {
        this.vncState = 'init';
        this.sendClientInit();
      }
    }
  }

  /**
   * Handle VNC authentication challenge
   */
  private handleAuthResponse(data: ArrayBuffer): void {
    if (data.byteLength === 16) {
      // VNC authentication challenge (16 bytes)
      this.log('Received VNC auth challenge');
      
      if (!this.options.password) {
        throw new Error('VNC authentication required but no password provided');
      }

      this.log('Using password for VNC auth, length:', this.options.password.length);

      // Encrypt the challenge with the password using VNC DES
      const challenge = new Uint8Array(data);
      this.log('Challenge received (hex):', Array.from(challenge).map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      const encrypted = this.vncEncrypt(this.options.password, challenge);
      this.log('Encrypted response (hex):', Array.from(encrypted).map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      this.sendMessage(encrypted.buffer);
      
      // Wait for auth result
      return;
    } else if (data.byteLength === 4) {
      // Authentication result (4 bytes)
      const result = new DataView(data).getUint32(0, false);
      if (result === 0) {
        this.log('VNC authentication successful');
        this.vncState = 'init';
        this.sendClientInit();
      } else {
        throw new Error('VNC authentication failed');
      }
    } else if (data.byteLength >= 8) {
      // Authentication result with reason (4 bytes result + 4 bytes length + reason text)
      const view = new DataView(data);
      const result = view.getUint32(0, false);
      
      if (result === 0) {
        this.log('VNC authentication successful');
        this.vncState = 'init';
        this.sendClientInit();
      } else {
        // Authentication failed with reason
        const reasonLength = view.getUint32(4, false);
        let reason = 'Authentication failed';
        
        if (data.byteLength >= 8 + reasonLength) {
          const reasonBytes = new Uint8Array(data, 8, reasonLength);
          reason = new TextDecoder().decode(reasonBytes).replace(/\0+$/, ''); // Remove null terminators
        }
        
        this.log('VNC authentication failed:', reason);
        // Close connection cleanly when auth fails
        if (this.ws) {
          this.ws.close(1000, 'Authentication failed');
        }
        throw new Error(`VNC authentication failed: ${reason}`);
      }
    } else {
      this.log('Unexpected auth response length:', data.byteLength);
      throw new Error(`Unexpected authentication response length: ${data.byteLength}`);
    }
  }

  /**
   * Send client init message
   */
  private sendClientInit(): void {
    this.log('Sending client init');
    const clientInit = VNCProtocolUtils.createClientInit(true);
    this.sendMessage(clientInit);
  }

  /**
   * Handle server init message
   */
  private handleServerInit(data: ArrayBuffer): void {
    if (data.byteLength >= 24) {
      this.serverInit = VNCProtocolUtils.parseServerInit(data);
      this.setState({
        connected: true,
        connecting: false,
        serverName: this.serverInit.name,
        width: this.serverInit.width,
        height: this.serverInit.height
      });

      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }

      this.vncState = 'connected';
      this.log('VNC connection established:', this.serverInit);
      this.emit('connected');
      
      // Request initial framebuffer update
      this.requestFramebufferUpdate(false);
    }
  }

  /**
   * Handle VNC protocol messages after connection established
   */
  private handleProtocolMessage(data: ArrayBuffer): void {
    // Handle framebuffer updates, server cut text, etc.
    // This is a simplified implementation
    this.log('Received protocol message, length:', data.byteLength);
  }

  /**
   * VNC DES encryption for authentication
   * Based on RFC 6143 with bit reversal fix (Errata ID 4951) and proven VNC implementations
   * Implementation derived from established VNC clients that work with all major VNC servers
   */
  private vncEncrypt(password: string, challenge: Uint8Array): Uint8Array {
    // Prepare the key from password (8 bytes, padded with zeros)
    const key = new Uint8Array(8);
    const passwordBytes = new TextEncoder().encode(password);
    
    // Copy password to key (pad with zeros or truncate to 8 bytes)
    for (let i = 0; i < 8; i++) {
      key[i] = i < passwordBytes.length ? passwordBytes[i] : 0;
    }

    this.log('Password bytes (before bit reversal):', Array.from(key).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // Reverse bits in each byte (VNC quirk from RFC 6143 Errata ID 4951)
    for (let i = 0; i < 8; i++) {
      let byte = key[i];
      byte = ((byte & 0x01) << 7) | ((byte & 0x02) << 5) | ((byte & 0x04) << 3) | ((byte & 0x08) << 1) |
             ((byte & 0x10) >> 1) | ((byte & 0x20) >> 3) | ((byte & 0x40) >> 5) | ((byte & 0x80) >> 7);
      key[i] = byte;
    }

    this.log('Password bytes (after bit reversal):', Array.from(key).map(b => b.toString(16).padStart(2, '0')).join(' '));

    // Encrypt the 16-byte challenge using proper VNC DES
    const result = new Uint8Array(16);
    
    // Encrypt first 8 bytes
    const block1 = this.vncDesEncrypt(new Uint8Array(challenge.subarray(0, 8)), key);
    result.set(block1, 0);
    
    // Encrypt second 8 bytes
    const block2 = this.vncDesEncrypt(new Uint8Array(challenge.subarray(8, 16)), key);
    result.set(block2, 8);

    return result;
  }

  /**
   * Proper VNC DES encryption implementation
   * Based on proven VNC implementations and RFC 6143 compliance
   * This implements the actual DES algorithm that VNC servers expect
   */
  private vncDesEncrypt(block: Uint8Array, key: Uint8Array): Uint8Array {
    // DES S-boxes (standard DES specification)
    const sBoxes = [
      // S1
      [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7,
       0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
       4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0,
       15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
      // S2
      [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10,
       3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5,
       0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15,
       13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
      // S3
      [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8,
       13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
       13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7,
       1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
      // S4
      [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15,
       13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
       10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4,
       3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
      // S5
      [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9,
       14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
       4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14,
       11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
      // S6
      [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11,
       10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
       9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6,
       4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
      // S7
      [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1,
       13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
       1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2,
       6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
      // S8
      [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7,
       1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
       7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8,
       2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]
    ];

    // Initial permutation
    const ip = [
      58, 50, 42, 34, 26, 18, 10, 2,
      60, 52, 44, 36, 28, 20, 12, 4,
      62, 54, 46, 38, 30, 22, 14, 6,
      64, 56, 48, 40, 32, 24, 16, 8,
      57, 49, 41, 33, 25, 17, 9, 1,
      59, 51, 43, 35, 27, 19, 11, 3,
      61, 53, 45, 37, 29, 21, 13, 5,
      63, 55, 47, 39, 31, 23, 15, 7
    ];

    // Final permutation (inverse of IP)
    const fp = [
      40, 8, 48, 16, 56, 24, 64, 32,
      39, 7, 47, 15, 55, 23, 63, 31,
      38, 6, 46, 14, 54, 22, 62, 30,
      37, 5, 45, 13, 53, 21, 61, 29,
      36, 4, 44, 12, 52, 20, 60, 28,
      35, 3, 43, 11, 51, 19, 59, 27,
      34, 2, 42, 10, 50, 18, 58, 26,
      33, 1, 41, 9, 49, 17, 57, 25
    ];

    // Expansion permutation
    const e = [
      32, 1, 2, 3, 4, 5,
      4, 5, 6, 7, 8, 9,
      8, 9, 10, 11, 12, 13,
      12, 13, 14, 15, 16, 17,
      16, 17, 18, 19, 20, 21,
      20, 21, 22, 23, 24, 25,
      24, 25, 26, 27, 28, 29,
      28, 29, 30, 31, 32, 1
    ];

    // Permutation after S-boxes
    const p = [
      16, 7, 20, 21, 29, 12, 28, 17,
      1, 15, 23, 26, 5, 18, 31, 10,
      2, 8, 24, 14, 32, 27, 3, 9,
      19, 13, 30, 6, 22, 11, 4, 25
    ];

    // Key schedule permutation
    const pc1 = [
      57, 49, 41, 33, 25, 17, 9,
      1, 58, 50, 42, 34, 26, 18,
      10, 2, 59, 51, 43, 35, 27,
      19, 11, 3, 60, 52, 44, 36,
      63, 55, 47, 39, 31, 23, 15,
      7, 62, 54, 46, 38, 30, 22,
      14, 6, 61, 53, 45, 37, 29,
      21, 13, 5, 28, 20, 12, 4
    ];

    const pc2 = [
      14, 17, 11, 24, 1, 5,
      3, 28, 15, 6, 21, 10,
      23, 19, 12, 4, 26, 8,
      16, 7, 27, 20, 13, 2,
      41, 52, 31, 37, 47, 55,
      30, 40, 51, 45, 33, 48,
      44, 49, 39, 56, 34, 53,
      46, 42, 50, 36, 29, 32
    ];

    // Left shifts for key schedule
    const shifts = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

    // Helper function to convert bits
    const bytesToBits = (bytes: Uint8Array): number[] => {
      const bits: number[] = [];
      for (const byte of bytes) {
        for (let i = 7; i >= 0; i--) {
          bits.push((byte >> i) & 1);
        }
      }
      return bits;
    };

    const bitsToBytes = (bits: number[]): Uint8Array => {
      const bytes = new Uint8Array(Math.ceil(bits.length / 8));
      for (let i = 0; i < bits.length; i++) {
        if (bits[i]) {
          bytes[Math.floor(i / 8)] |= (1 << (7 - (i % 8)));
        }
      }
      return bytes;
    };

    const permute = (input: number[], table: number[]): number[] => {
      return table.map(pos => input[pos - 1]);
    };

    const leftShift = (input: number[], shifts: number): number[] => {
      return [...input.slice(shifts), ...input.slice(0, shifts)];
    };

    // Convert input to bits
    const blockBits = bytesToBits(block);
    const keyBits = bytesToBits(key);

    // Initial permutation
    const ipResult = permute(blockBits, ip);

    // Split into left and right halves
    let left = ipResult.slice(0, 32);
    let right = ipResult.slice(32, 64);

    // Key schedule
    const keyPermuted = permute(keyBits, pc1);
    let c = keyPermuted.slice(0, 28);
    let d = keyPermuted.slice(28, 56);

    // 16 rounds
    for (let round = 0; round < 16; round++) {
      // Key schedule for this round
      c = leftShift(c, shifts[round]);
      d = leftShift(d, shifts[round]);
      const roundKey = permute([...c, ...d], pc2);

      // Feistel function
      const expanded = permute(right, e);
      
      // XOR with round key
      const xored = expanded.map((bit, i) => bit ^ roundKey[i]);

      // S-box substitution
      let sBoxOutput: number[] = [];
      for (let s = 0; s < 8; s++) {
        const chunk = xored.slice(s * 6, (s + 1) * 6);
        const row = (chunk[0] << 1) | chunk[5];
        const col = (chunk[1] << 3) | (chunk[2] << 2) | (chunk[3] << 1) | chunk[4];
        const sValue = sBoxes[s][row * 16 + col];
        
        // Convert to 4 bits
        for (let i = 3; i >= 0; i--) {
          sBoxOutput.push((sValue >> i) & 1);
        }
      }

      // Final permutation of round
      const fResult = permute(sBoxOutput, p);

      // XOR with left half
      const newRight = left.map((bit, i) => bit ^ fResult[i]);
      
      // Swap for next round
      left = right;
      right = newRight;
    }

    // Final permutation (note: left and right are swapped)
    const preOutput = [...right, ...left];
    const finalResult = permute(preOutput, fp);

    return bitsToBytes(finalResult);
  }

  /**
   * Send binary message
   */
  private sendMessage(data: ArrayBuffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  /**
   * Send raw string message as binary data
   */
  private sendRawMessage(data: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Convert string to binary data since some servers only accept binary frames
      const encoder = new TextEncoder();
      const binaryData = encoder.encode(data);
      this.ws.send(binaryData.buffer);
    }
  }

  /**
   * Convert keyboard event to VNC key code
   */
  private keyToVNCKey(key: string, code: string): number {
    // Simplified key mapping - real implementation would be more comprehensive
    const keyMap: Record<string, number> = {
      'Backspace': 0xff08,
      'Tab': 0xff09,
      'Enter': 0xff0d,
      'Escape': 0xff1b,
      'Delete': 0xffff,
      'ArrowLeft': 0xff51,
      'ArrowUp': 0xff52,
      'ArrowRight': 0xff53,
      'ArrowDown': 0xff54,
      ' ': 0x20,
    };

    if (keyMap[key]) {
      return keyMap[key];
    }

    // For regular characters
    if (key.length === 1) {
      return key.charCodeAt(0);
    }

    return 0;
  }

  /**
   * Debug logging
   */
  private log(...args: any[]): void {
    if (this.options.debug) {
      console.log('[VNC]', ...args);
    }
  }

  /**
   * Clean up existing connection state without triggering disconnect events
   */
  private cleanupExistingConnection(): void {
    // Clear any existing connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // Clean up existing WebSocket if present
    if (this.ws) {
      // Remove event handlers to prevent unwanted events during cleanup
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      
      // Close the WebSocket if it's still open
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Reconnecting');
      }
      
      this.ws = null;
    }

    // Reset VNC-specific state
    this.serverInit = null;
    this.vncState = 'version';
  }
} 