import { useEffect, useRef, useState, useCallback } from 'react';
import { VNCClient } from '../core/VNCClient';
import {
  VNCClientOptions,
  VNCConnectionState,
  VNCEvent,
  VNCKeyEvent,
  VNCPointerEvent
} from '../types/vnc';

export interface UseVNCOptions extends VNCClientOptions {
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** Auto-disconnect on unmount */
  autoDisconnect?: boolean;
}

export interface UseVNCReturn {
  /** VNC client instance */
  client: VNCClient | null;
  /** Connection state */
  state: VNCConnectionState;
  /** Connect to VNC server */
  connect: () => Promise<void>;
  /** Disconnect from VNC server */
  disconnect: () => void;
  /** Send key event */
  sendKeyEvent: (event: VNCKeyEvent) => void;
  /** Send pointer event */
  sendPointerEvent: (event: VNCPointerEvent) => void;
  /** Request framebuffer update */
  requestUpdate: (incremental?: boolean) => void;
  /** Canvas ref for rendering */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Error message */
  error: string | null;
  /** Loading state */
  loading: boolean;
}

/**
 * React hook for VNC client functionality
 */
export function useVNC(options: UseVNCOptions): UseVNCReturn {
  const clientRef = useRef<VNCClient | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMountedRef = useRef(true);
  const [state, setState] = useState<VNCConnectionState>({
    connected: false,
    connecting: false,
    error: null,
    serverName: null,
    width: 0,
    height: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize client
  useEffect(() => {
    isMountedRef.current = true;
    const client = new VNCClient(options);
    clientRef.current = client;

    // Set up event listeners
    const handleEvent = (event: VNCEvent) => {
      switch (event.type) {
        case 'connecting':
          setLoading(true);
          setError(null);
          break;
        case 'connected':
          setLoading(false);
          setState(client.getState());
          break;
        case 'disconnected':
          setLoading(false);
          setState(client.getState());
          break;
        case 'error':
          setLoading(false);
          setError(event.data?.message || 'Unknown error');
          setState(client.getState());
          break;
        case 'framebuffer-update':
          // Handle framebuffer updates here
          renderToCanvas(event.data);
          break;
        case 'resize':
          setState(client.getState());
          resizeCanvas();
          break;
      }
    };

    // Register event listeners
    client.on('connecting', handleEvent);
    client.on('connected', handleEvent);
    client.on('disconnected', handleEvent);
    client.on('error', handleEvent);
    client.on('framebuffer-update', handleEvent);
    client.on('resize', handleEvent);

    // Auto-connect if specified
    if (options.autoConnect) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      // Use setTimeout to defer disconnection and allow for quick re-mount (StrictMode)
      setTimeout(() => {
        if (!isMountedRef.current && options.autoDisconnect !== false) {
          client.disconnect();
        }
      }, 100);
    };
  }, [options.url, options.autoConnect, options.autoDisconnect]);

  // Connect function
  const connect = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      await clientRef.current.connect();
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (!clientRef.current) return;
    clientRef.current.disconnect();
  }, []);

  // Send key event
  const sendKeyEvent = useCallback((event: VNCKeyEvent) => {
    if (!clientRef.current) return;
    clientRef.current.sendKeyEvent(event);
  }, []);

  // Send pointer event
  const sendPointerEvent = useCallback((event: VNCPointerEvent) => {
    if (!clientRef.current) return;
    clientRef.current.sendPointerEvent(event);
  }, []);

  // Request framebuffer update
  const requestUpdate = useCallback((incremental: boolean = true) => {
    if (!clientRef.current) return;
    clientRef.current.requestFramebufferUpdate(incremental);
  }, []);

  // Render framebuffer to canvas
  const renderToCanvas = useCallback((imageData: ImageData) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.putImageData(imageData, 0, 0);
  }, []);

  // Resize canvas to match server resolution
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !clientRef.current) return;

    const clientState = clientRef.current.getState();
    if (clientState.width > 0 && clientState.height > 0) {
      canvas.width = clientState.width;
      canvas.height = clientState.height;
      
      if (options.scale && options.scale !== 1) {
        canvas.style.width = `${clientState.width * options.scale}px`;
        canvas.style.height = `${clientState.height * options.scale}px`;
      }
    }
  }, [options.scale]);

  // Update canvas size when state changes
  useEffect(() => {
    if (state.connected && state.width > 0 && state.height > 0) {
      resizeCanvas();
    }
  }, [state.connected, state.width, state.height, resizeCanvas]);

  return {
    client: clientRef.current,
    state,
    connect,
    disconnect,
    sendKeyEvent,
    sendPointerEvent,
    requestUpdate,
    canvasRef,
    error,
    loading
  };
} 