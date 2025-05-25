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
    this.emit('connecting');

    try {
      this.ws = new WebSocket(this.options.url);
      this.ws.binaryType = 'arraybuffer';

      this.setupWebSocketHandlers();
      this.setupConnectionTimeout();

      return new Promise((resolve, reject) => {
        const onConnected = () => {
          this.off('connected', onConnected);
          this.off('error', onError);
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
   * Disconnect from VNC server
   */
  disconnect(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
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
   * Send key event
   */
  sendKeyEvent(event: VNCKeyEvent): void {
    if (!this.state.connected || this.options.viewOnly) return;

    const keyCode = this.keyToVNCKey(event.key, event.code);
    const message = VNCProtocolUtils.createKeyEvent(event.down, keyCode);
    this.sendMessage(message);
  }

  /**
   * Send pointer event
   */
  sendPointerEvent(event: VNCPointerEvent): void {
    if (!this.state.connected || this.options.viewOnly) return;

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
      this.log('WebSocket opened');
      this.handleProtocolVersion();
    };

    this.ws.onmessage = (event) => {
      this.handleServerMessage(event.data);
    };

    this.ws.onclose = (event) => {
      this.log('WebSocket closed', event.code, event.reason);
      this.setState({ connected: false, connecting: false });
      this.emit('disconnected');
    };

    this.ws.onerror = (event) => {
      this.log('WebSocket error', event);
      const message = 'WebSocket connection error';
      this.setState({ connecting: false, connected: false, error: message });
      this.emit('error', { message });
    };
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
    // VNC protocol version 3.8
    const version = 'RFB 003.008\n';
    this.sendRawMessage(version);
  }

  /**
   * Handle server messages
   */
  private handleServerMessage(data: ArrayBuffer): void {
    // This is a simplified version - real implementation would handle
    // various VNC protocol messages like security handshake, server init, etc.
    if (data.byteLength >= 24) {
      // Assume this is server init message for demo
      try {
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

        this.emit('connected');
        this.requestFramebufferUpdate(false);
      } catch (error) {
        this.log('Error parsing server init:', error);
      }
    }
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