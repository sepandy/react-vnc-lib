// Next.js Example - pages/vnc-viewer.tsx
import React from 'react';
import { VNCViewer } from 'react-vnc-lib';

export default function VNCViewerPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>VNC Remote Desktop</h1>
      
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '8px',
        padding: '10px',
        maxWidth: '1000px'
      }}>
        <VNCViewer
          url="ws://localhost:6080"
          autoConnect={false}
          scale={0.8}
          viewOnly={false}
          showStatus={true}
          showLoading={true}
          autoFocus={true}
          connectButtonText="Connect to Server"
          disconnectButtonText="Disconnect"
          style={{
            width: '100%',
            height: '600px'
          }}
        />
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p><strong>Instructions:</strong></p>
        <ul>
          <li>Make sure you have a VNC server running on localhost:5900</li>
          <li>Start websockify: <code>websockify 6080 localhost:5900</code></li>
          <li>Click "Connect to Server" to establish connection</li>
          <li>Use mouse and keyboard to interact with the remote desktop</li>
        </ul>
      </div>
    </div>
  );
} 