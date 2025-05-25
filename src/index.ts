// Core VNC client
export { VNCClient } from './core/VNCClient';

// Types
export type {
  VNCClientOptions,
  VNCConnectionState,
  VNCRect,
  VNCPixelFormat,
  VNCServerInitMessage,
  VNCFramebufferUpdate,
  VNCKeyEvent,
  VNCPointerEvent,
  VNCEventType,
  VNCEvent,
  VNCEventHandler
} from './types/vnc';

// Protocol utilities
export { VNCProtocolUtils } from './utils/protocol';

// React hooks and components (conditional exports)
export type { UseVNCOptions, UseVNCReturn } from './hooks/useVNC';
export type { VNCViewerProps } from './components/VNCViewer';

// React exports - will be undefined if React is not available
export { useVNC } from './hooks/useVNC';
export { VNCViewer } from './components/VNCViewer';

// Default export for convenience
export { VNCClient as default } from './core/VNCClient'; 