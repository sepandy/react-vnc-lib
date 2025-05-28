import React, { useEffect, useCallback, useState } from 'react';
import { useVNC, UseVNCOptions } from '../hooks/useVNC';
import { VNCKeyEvent, VNCPointerEvent } from '../types/vnc';
import '../styles/VNCViewer.css';

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
  /** Show blinking cursor when ready to type */
  showCursor?: boolean;
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
  showCursor = true,
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

  const [isFocused, setIsFocused] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blinking cursor effect
  useEffect(() => {
    if (!showCursor || !isFocused || !state.connected || disableKeyboard) {
      setCursorVisible(false);
      return;
    }

    const interval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 530); // Standard cursor blink rate

    return () => clearInterval(interval);
  }, [showCursor, isFocused, state.connected, disableKeyboard]);

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

  // Handle canvas focus
  const handleCanvasFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleCanvasBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // Auto-focus canvas for keyboard events
  useEffect(() => {
    if (autoFocus && state.connected && canvasRef.current) {
      canvasRef.current.focus();
    }
  }, [autoFocus, state.connected]);

  // Default styles to fill parent
  const defaultStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    backgroundColor: '#000',
    color: '#fff',
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
    ...style
  };

  // Render loading component
  if (loading && showLoading) {
    return (
      <div className={`vnc-viewer vnc-viewer--loading ${className}`} style={defaultStyle}>
        {loadingComponent || (
          <div className="vnc-loading">
            <div className="vnc-loading__text">Connecting to VNC server...</div>
          </div>
        )}
      </div>
    );
  }

  // Render error component
  if (error) {
    return (
      <div className={`vnc-viewer vnc-viewer--error ${className}`} style={defaultStyle}>
        {errorComponent || (
          <div className="vnc-error">
            <div className="vnc-error__text">Connection Error: {error}</div>
            <button 
              className="vnc-error__button"
              onClick={connect} 
              disabled={state.connecting}
            >
              {state.connecting ? 'Connecting...' : connectButtonText}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`vnc-viewer vnc-viewer--connected ${className}`} style={defaultStyle}>
      {showStatus && (
        <div className="vnc-status">
          <div className="vnc-status__info">
            <span className="vnc-status__text">
              Status: <span className={`vnc-status__indicator vnc-status__indicator--${state.connected ? 'connected' : 'disconnected'}`}>
                {state.connected ? 'Connected' : 'Disconnected'}
              </span>
              {state.serverName && <span className="vnc-status__server"> - {state.serverName}</span>}
              {state.width > 0 && state.height > 0 && 
                <span className="vnc-status__resolution"> ({state.width}x{state.height})</span>
              }
            </span>
          </div>
          <div className="vnc-controls">
            {!state.connected ? (
              <button 
                className="vnc-controls__button vnc-controls__button--connect"
                onClick={connect} 
                disabled={state.connecting}
              >
                {state.connecting ? 'Connecting...' : connectButtonText}
              </button>
            ) : (
              <button 
                className="vnc-controls__button vnc-controls__button--disconnect"
                onClick={disconnect}
              >
                {disconnectButtonText}
              </button>
            )}
          </div>
        </div>
      )}
      
      <div className="vnc-canvas-container">
        <canvas
          ref={canvasRef}
          className={`vnc-canvas ${isFocused ? 'vnc-canvas--focused' : ''}`}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onFocus={handleCanvasFocus}
          onBlur={handleCanvasBlur}
          style={{
            outline: 'none',
            cursor: disableMouse ? 'default' : 'pointer',
            border: '1px solid #333',
            background: '#000',
            display: 'block',
            maxWidth: '100%',
            maxHeight: '100%',
            flex: 1,
            position: 'relative'
          }}
        />
        
        {/* Blinking cursor indicator */}
        {showCursor && isFocused && state.connected && !disableKeyboard && (
          <div 
            className={`vnc-cursor ${cursorVisible ? 'vnc-cursor--visible' : 'vnc-cursor--hidden'}`}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              width: '2px',
              height: '16px',
              backgroundColor: '#00ff00',
              pointerEvents: 'none',
              zIndex: 10
            }}
          />
        )}
      </div>
    </div>
  );
};

export default VNCViewer; 