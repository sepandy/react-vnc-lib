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

    this.setState({ connecting: true, error: null });
    this.vncState = 'version'; // Reset VNC protocol state
    this.emit('connecting');

    try {
      // Validate URL
      if (!this.isValidWebSocketUrl(this.options.url)) {
        throw new Error('Invalid WebSocket URL');
      }

      this.log('Attempting to connect to:', this.options.url);
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
    this.log('WebSocket connection opened, starting VNC handshake');
    // All connections use standard VNC protocol
    this.handleProtocolVersion();
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
      this.attemptReconnect();
    }
  }

  /**
   * Handle WebSocket errors
   */
  private handleConnectionError(event: Event): void {
    this.log('WebSocket error details:', event);
    
    let message = 'WebSocket connection error';
    
    
    this.setState({ connecting: false, connected: false, error: message });
    this.emit('error', { message });
  }

  /**
   * Check if we should attempt reconnection
   */
  private shouldAttemptReconnect(closeCode: number): boolean {
    return closeCode === 1006 && this.reconnectAttempts < this.maxReconnectAttempts;
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
        this.connect().catch(error => {
          this.log('Reconnection failed:', error.message);
        });
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
    this.log('Starting VNC protocol handshake');
    this.vncState = 'version';
    // VNC protocol version 3.8
    const version = 'RFB 003.008\n';
    this.sendRawMessage(version);
  }

  /**
   * Handle server messages based on VNC protocol state
   */
  private handleServerMessage(data: ArrayBuffer): void {
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
      this.log('Server version:', response.trim());
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

      // Encrypt the challenge with the password using DES
      const challenge = new Uint8Array(data);
      const encrypted = this.vncEncrypt(this.options.password, challenge);
      
      this.sendMessage(encrypted.buffer);
      
      // Wait for auth result
      return;
    } else if (data.byteLength === 4) {
      // Authentication result
      const result = new DataView(data).getUint32(0, false);
      if (result === 0) {
        this.log('VNC authentication successful');
        this.vncState = 'init';
        this.sendClientInit();
      } else {
        throw new Error('VNC authentication failed');
      }
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
   * Simple VNC DES encryption for authentication
   * Note: This is a basic implementation. For production, use a proper crypto library.
   */
  private vncEncrypt(password: string, challenge: Uint8Array): Uint8Array {
    // VNC uses DES encryption with the password as key
    // This is a simplified version - in production you'd use a proper DES implementation
    const key = new Uint8Array(8);
    const passwordBytes = new TextEncoder().encode(password);
    
    // Copy password to key (pad with zeros or truncate to 8 bytes)
    for (let i = 0; i < 8; i++) {
      key[i] = i < passwordBytes.length ? passwordBytes[i] : 0;
    }

    // Reverse bits in each byte (VNC quirk)
    for (let i = 0; i < 8; i++) {
      let byte = key[i];
      byte = ((byte & 0x01) << 7) | ((byte & 0x02) << 5) | ((byte & 0x04) << 3) | ((byte & 0x08) << 1) |
             ((byte & 0x10) >> 1) | ((byte & 0x20) >> 3) | ((byte & 0x40) >> 5) | ((byte & 0x80) >> 7);
      key[i] = byte;
    }

    // For this simplified implementation, we'll just XOR with the key
    // In production, use proper DES encryption
    const result = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      result[i] = challenge[i] ^ key[i % 8];
    }

    return result;
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
   * Send raw string message
   */
  private sendRawMessage(data: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
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
} 