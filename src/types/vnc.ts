export interface VNCClientOptions {
  /** WebSocket URL to VNC server */
  url: string;
  /** Username for authentication */
  username?: string;
  /** Password for authentication */
  password?: string;
  /** Enable/disable view only mode */
  viewOnly?: boolean;
  /** Quality setting (0-9, where 9 is best quality) */
  quality?: number;
  /** Compression level (0-9, where 9 is max compression) */
  compression?: number;
  /** Auto-resize canvas to match server resolution */
  autoResize?: boolean;
  /** Scale factor for display (0.1 to 2.0) */
  scale?: number;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** WebSocket subprotocols for cloud VNC services */
  protocols?: string[];
}

export interface VNCConnectionState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  serverName: string | null;
  width: number;
  height: number;
}

export interface VNCRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VNCPixelFormat {
  bitsPerPixel: number;
  depth: number;
  bigEndian: boolean;
  trueColor: boolean;
  redMax: number;
  greenMax: number;
  blueMax: number;
  redShift: number;
  greenShift: number;
  blueShift: number;
}

export interface VNCServerInitMessage {
  width: number;
  height: number;
  pixelFormat: VNCPixelFormat;
  name: string;
}

export interface VNCFramebufferUpdate {
  rectangles: VNCRect[];
  imageData?: ImageData;
}

export interface VNCKeyEvent {
  key: string;
  code: string;
  down: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}

export interface VNCPointerEvent {
  x: number;
  y: number;
  buttons: number;
}

export type VNCEventType = 
  | 'connecting'
  | 'connected' 
  | 'disconnected'
  | 'error'
  | 'framebuffer-update'
  | 'server-cut-text'
  | 'bell'
  | 'resize';

export interface VNCEvent {
  type: VNCEventType;
  data?: any;
}

export type VNCEventHandler = (event: VNCEvent) => void; 