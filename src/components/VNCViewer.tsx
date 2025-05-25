import React, { useEffect, useCallback } from 'react';
import { useVNC, UseVNCOptions } from '../hooks/useVNC';
import { VNCKeyEvent, VNCPointerEvent } from '../types/vnc';

export interface VNCViewerProps extends UseVNCOptions {
  /** Custom CSS class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Show connection status */
  showStatus?: boolean;
  /** Show loading indicator */
  showLoading?: boolean;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Disable keyboard input */
  disableKeyboard?: boolean;
  /** Disable mouse input */
  disableMouse?: boolean;
  /** Handle focus automatically */
  autoFocus?: boolean;
  /** Custom connection button text */
  connectButtonText?: string;
  /** Custom disconnect button text */
  disconnectButtonText?: string;
}

export const VNCViewer: React.FC<VNCViewerProps> = ({
  className = '',
  style = {},
  showStatus = true,
  showLoading = true,
  loadingComponent,
  errorComponent,
  disableKeyboard = false,
  disableMouse = false,
  autoFocus = true,
  connectButtonText = 'Connect',
  disconnectButtonText = 'Disconnect',
  ...vncOptions
}) => {
  const {
    state,
    connect,
    disconnect,
    sendKeyEvent,
    sendPointerEvent,
    canvasRef,
    error,
    loading
  } = useVNC(vncOptions);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disableKeyboard || !state.connected) return;
    
    event.preventDefault();
    
    const vncEvent: VNCKeyEvent = {
      key: event.key,
      code: event.code,
      down: true,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    };
    
    sendKeyEvent(vncEvent);
  }, [disableKeyboard, state.connected, sendKeyEvent]);

  const handleKeyUp = useCallback((event: React.KeyboardEvent) => {
    if (disableKeyboard || !state.connected) return;
    
    event.preventDefault();
    
    const vncEvent: VNCKeyEvent = {
      key: event.key,
      code: event.code,
      down: false,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    };
    
    sendKeyEvent(vncEvent);
  }, [disableKeyboard, state.connected, sendKeyEvent]);

  // Handle mouse events
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (disableMouse || !state.connected) return;
    
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const vncEvent: VNCPointerEvent = {
      x: Math.floor(x / (vncOptions.scale || 1)),
      y: Math.floor(y / (vncOptions.scale || 1)),
      buttons: event.buttons
    };
    
    sendPointerEvent(vncEvent);
  }, [disableMouse, state.connected, sendPointerEvent, vncOptions.scale]);

  const handleMouseUp = useCallback((event: React.MouseEvent) => {
    if (disableMouse || !state.connected) return;
    
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const vncEvent: VNCPointerEvent = {
      x: Math.floor(x / (vncOptions.scale || 1)),
      y: Math.floor(y / (vncOptions.scale || 1)),
      buttons: 0
    };
    
    sendPointerEvent(vncEvent);
  }, [disableMouse, state.connected, sendPointerEvent, vncOptions.scale]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (disableMouse || !state.connected) return;
    
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const vncEvent: VNCPointerEvent = {
      x: Math.floor(x / (vncOptions.scale || 1)),
      y: Math.floor(y / (vncOptions.scale || 1)),
      buttons: event.buttons
    };
    
    sendPointerEvent(vncEvent);
  }, [disableMouse, state.connected, sendPointerEvent, vncOptions.scale]);

  // Auto-focus canvas for keyboard events
  useEffect(() => {
    if (autoFocus && state.connected && canvasRef.current) {
      canvasRef.current.focus();
    }
  }, [autoFocus, state.connected]);

  // Render loading component
  if (loading && showLoading) {
    return (
      <div className={`vnc-viewer ${className}`} style={style}>
        {loadingComponent || (
          <div className="vnc-loading">
            <div>Connecting to VNC server...</div>
          </div>
        )}
      </div>
    );
  }

  // Render error component
  if (error) {
    return (
      <div className={`vnc-viewer ${className}`} style={style}>
        {errorComponent || (
          <div className="vnc-error">
            <div>Connection Error: {error}</div>
            <button onClick={connect} disabled={state.connecting}>
              {state.connecting ? 'Connecting...' : connectButtonText}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`vnc-viewer ${className}`} style={style}>
      {showStatus && (
        <div className="vnc-status">
          <div className="vnc-status-info">
            Status: {state.connected ? 'Connected' : 'Disconnected'}
            {state.serverName && ` - ${state.serverName}`}
            {state.width > 0 && state.height > 0 && 
              ` (${state.width}x${state.height})`
            }
          </div>
          <div className="vnc-controls">
            {!state.connected ? (
              <button onClick={connect} disabled={state.connecting}>
                {state.connecting ? 'Connecting...' : connectButtonText}
              </button>
            ) : (
              <button onClick={disconnect}>
                {disconnectButtonText}
              </button>
            )}
          </div>
        </div>
      )}
      
      <div className="vnc-canvas-container">
        <canvas
          ref={canvasRef}
          className="vnc-canvas"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          style={{
            outline: 'none',
            cursor: disableMouse ? 'default' : 'crosshair',
            border: '1px solid #ccc',
            background: '#000'
          }}
        />
      </div>
    </div>
  );
};

export default VNCViewer; 