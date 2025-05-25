# React VNC Library 🖥️

[![npm version](https://badge.fury.io/js/react-vnc-lib.svg)](https://badge.fury.io/js/react-vnc-lib)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, lightweight VNC client library for React applications with **working VNC authentication**! 

## ✨ Key Features

- 🎯 **Working VNC Authentication** - RFC 6143 compliant with proper DES implementation
- ⚡ **WebSocket Support** - Real-time VNC connections over WebSocket
- 🔒 **Secure** - Supports both VNC authentication and "None" security types
- 🌐 **Hetzner Compatible** - Tested with Hetzner VNC web console
- 📱 **Responsive** - Auto-scaling and touch/mouse input support
- 🎨 **Modern React** - Hooks-based API with TypeScript support
- 🔧 **Flexible** - Works with any VNC server (TightVNC, RealVNC, etc.)

## 🚀 Quick Start

### Installation

```bash
npm install react-vnc-lib
# or
yarn add react-vnc-lib
```

### Basic Usage

```tsx
import React from 'react';
import { useVNC } from 'react-vnc-lib';

function VNCViewer() {
  const { connect, disconnect, state, canvasRef } = useVNC({
    url: 'wss://your-vnc-server.com/websockify',
    password: 'your-vnc-password',  // Now works properly!
    viewOnly: false,
    scale: 1.0,
    debug: true
  });

  return (
    <div>
      <div>
        <button onClick={connect} disabled={state.connecting || state.connected}>
          Connect
        </button>
        <button onClick={disconnect} disabled={!state.connected}>
          Disconnect
        </button>
        <p>Status: {state.connected ? 'Connected' : state.connecting ? 'Connecting' : 'Disconnected'}</p>
        {state.error && <p>Error: {state.error}</p>}
      </div>
      
      <canvas
        ref={canvasRef}
        width={state.width}
        height={state.height}
        style={{ border: '1px solid #ccc', maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
}

export default VNCViewer;
```

## 🎯 Authentication Status: WORKING ✅

This library now has **fully working VNC authentication**! Here's what was fixed:

### RFC 6143 Compliance ✅
- ✅ Implements missing bit reversal from [RFC 6143 Errata ID 4951](https://www.rfc-editor.org/errata/eid4951)
- ✅ VNC-specific DES encryption based on proven implementations
- ✅ Proper challenge/response handling
- ✅ Binary WebSocket frame support

### Tested Compatibility ✅
- ✅ **Hetzner VNC Web Console**
- ✅ TightVNC Servers
- ✅ RealVNC Servers
- ✅ Standard VNC Authentication (Security Type 2)
- ✅ No Authentication (Security Type 1)

## 📋 Configuration Options

```tsx
interface VNCClientOptions {
  url: string;                 // WebSocket URL (ws:// or wss://)
  username?: string;           // Optional username (for future auth types)
  password?: string;           // VNC password (now works properly!)
  viewOnly?: boolean;          // Read-only mode (default: false)
  quality?: number;            // Image quality 1-10 (default: 6)
  compression?: number;        // Compression level 1-10 (default: 2)
  autoResize?: boolean;        // Auto resize canvas (default: true)
  scale?: number;              // Display scale factor (default: 1.0)
  timeout?: number;            // Connection timeout ms (default: 10000)
  debug?: boolean;             // Enable debug logging (default: false)
}
```

## 🔧 Advanced Usage

### Connection Management

```tsx
import { VNCClient } from 'react-vnc-lib';

// Direct VNC client usage
const client = new VNCClient({
  url: 'wss://vnc.example.com/websockify',
  password: 'secret123',
  debug: true
});

// Event handling
client.on('connected', () => console.log('VNC Connected!'));
client.on('disconnected', () => console.log('VNC Disconnected'));
client.on('error', (event) => console.error('VNC Error:', event.data.message));

// Connect
await client.connect();

// Send input
client.sendKeyEvent({ key: 'Enter', down: true, code: 'Enter' });
client.sendPointerEvent({ x: 100, y: 100, buttons: 1 });

// Disconnect
client.disconnect();
```

### Error Handling

```tsx
function VNCViewer() {
  const { connect, state } = useVNC({
    url: 'wss://vnc.example.com/websockify',
    password: 'secret'
  });

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Connection failed:', error.message);
      // Handle specific error types
      if (error.message.includes('Authentication failed')) {
        alert('Invalid password');
      } else if (error.message.includes('Connection timeout')) {
        alert('Server not reachable');
      }
    }
  };

  return (
    <div>
      <button onClick={handleConnect}>Connect</button>
      {state.error && <p style={{color: 'red'}}>Error: {state.error}</p>}
    </div>
  );
}
```

## 🐛 Troubleshooting

### Common Issues

1. **Authentication Fails**
   ```
   Enable debug mode and check console for challenge/response hex values
   Ensure password is correct and server supports VNC Authentication
   ```

2. **Connection Refused** 
   ```
   Check WebSocket URL format (ws:// or wss://)
   Verify server is running and accessible
   Check for CORS issues in browser
   ```

3. **WebSocket Close Codes**
   ```
   1006: Connection lost unexpectedly
   1003: Server rejected connection due to invalid data  
   1002: Protocol error
   ```

### Debug Mode

Enable debug logging to see detailed connection information:

```tsx
const { connect } = useVNC({
  url: 'wss://vnc.example.com/websockify',
  password: 'secret',
  debug: true  // Enables detailed console logging
});
```

## 🏗️ Architecture

### VNC Protocol Flow
1. **WebSocket Connection** - Establish WebSocket to VNC server
2. **Version Handshake** - Negotiate RFB protocol version (3.8)
3. **Security Negotiation** - Choose authentication method
4. **Authentication** - VNC password authentication with DES encryption
5. **Initialization** - Exchange client/server capabilities
6. **Protocol Messages** - Framebuffer updates, input events, etc.

### DES Implementation
This library uses a **VNC-specific DES implementation** that:
- Implements proper bit reversal (RFC 6143 Errata ID 4951)
- Uses simplified Feistel network suitable for VNC
- Based on proven working VNC client implementations
- Maintains compatibility with all major VNC servers

## 📜 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- RFC 6143 specification authors
- VNC community for protocol documentation  
- [RFC 6143 Errata ID 4951](https://www.rfc-editor.org/errata/eid4951) for the critical bit reversal fix
- [Vidar Holen's VNC DES analysis](https://www.vidarholen.net/contents/junk/vnc.html)
- Open source VNC implementations for reference

---

**Note**: This library implements VNC authentication correctly based on RFC 6143 with the required errata fixes. Previous versions had authentication issues that are now resolved in v1.3.0+.

## Features

- 🚀 **Modern TypeScript** - Full type safety and modern ES2020+ features
- ⚡ **Minimal Dependencies** - Zero runtime dependencies, React as optional peer dependency
- 🎯 **WebSocket Based** - Real-time VNC protocol over WebSocket
- 🖱️ **Full Input Support** - Keyboard and mouse event handling
- 📱 **Responsive** - Canvas-based rendering with scaling support
- 🔧 **Configurable** - Extensive customization options
- 🎨 **React Components** - Ready-to-use React hook and component

## Installation

```bash
# With npm
npm install react-vnc-lib

# With yarn
yarn add react-vnc-lib

# With pnpm
pnpm add react-vnc-lib

# With bun
bun add react-vnc-lib
```

### Peer Dependencies

For React usage, install the peer dependencies:

```bash
npm install react react-dom
```

## Quick Start

### React Component Usage

```tsx
import React from 'react';
import { VNCViewer } from 'react-vnc-lib';

function App() {
  return (
    <div className="App">
      <VNCViewer
        url="ws://localhost:6080"
        autoConnect={true}
        scale={0.8}
        viewOnly={false}
        showStatus={true}
      />
    </div>
  );
}

export default App;
```

### React Hook Usage

```tsx
import React from 'react';
import { useVNC } from 'react-vnc-lib';

function CustomVNCViewer() {
  const {
    state,
    connect,
    disconnect,
    canvasRef,
    error,
    loading
  } = useVNC({
    url: 'ws://localhost:6080',
    autoConnect: true,
    debug: true
  });

  return (
    <div>
      <div>Status: {state.connected ? 'Connected' : 'Disconnected'}</div>
      {error && <div>Error: {error}</div>}
      
      <canvas ref={canvasRef} />
      
      <button onClick={connect} disabled={loading}>
        Connect
      </button>
      <button onClick={disconnect}>
        Disconnect
      </button>
    </div>
  );
}
```

### Vanilla JavaScript / Node.js Usage

```javascript
import { VNCClient } from 'react-vnc-lib';

const client = new VNCClient({
  url: 'ws://localhost:6080',
  username: 'user',
  password: 'password',
  debug: true
});

// Set up event listeners
client.on('connected', () => {
  console.log('Connected to VNC server');
});

client.on('error', (event) => {
  console.error('VNC Error:', event.data.message);
});

client.on('framebuffer-update', (event) => {
  console.log('Received framebuffer update');
  // Handle framebuffer data
});

// Connect
await client.connect();

// Send keyboard input
client.sendKeyEvent({
  key: 'a',
  code: 'KeyA',
  down: true
});

// Send mouse input
client.sendPointerEvent({
  x: 100,
  y: 100,
  buttons: 1
});

// Disconnect
client.disconnect();
```

## API Reference

### VNCClient

Main VNC client class for establishing connections and handling protocol communication.

#### Constructor

```typescript
new VNCClient(options: VNCClientOptions)
```

#### Options

```typescript
interface VNCClientOptions {
  url: string;                    // WebSocket URL to VNC server
  username?: string;              // Username for authentication
  password?: string;              // Password for authentication
  viewOnly?: boolean;             // Enable view-only mode (default: false)
  quality?: number;               // Quality setting 0-9 (default: 6)
  compression?: number;           // Compression level 0-9 (default: 2)
  autoResize?: boolean;           // Auto-resize canvas (default: true)
  scale?: number;                 // Scale factor 0.1-2.0 (default: 1.0)
  timeout?: number;               // Connection timeout ms (default: 10000)
  debug?: boolean;                // Enable debug logging (default: false)
}
```

#### Methods

- `connect(): Promise<void>` - Connect to VNC server
- `disconnect(): void` - Disconnect from server
- `sendKeyEvent(event: VNCKeyEvent): void` - Send keyboard event
- `sendPointerEvent(event: VNCPointerEvent): void` - Send mouse event
- `requestFramebufferUpdate(incremental?: boolean): void` - Request screen update
- `getState(): VNCConnectionState` - Get current connection state
- `on(event: string, handler: VNCEventHandler): void` - Add event listener
- `off(event: string, handler: VNCEventHandler): void` - Remove event listener

### useVNC Hook

React hook for VNC client integration.

```typescript
const vncState = useVNC(options: UseVNCOptions);
```

#### Returns

```typescript
interface UseVNCReturn {
  client: VNCClient | null;
  state: VNCConnectionState;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendKeyEvent: (event: VNCKeyEvent) => void;
  sendPointerEvent: (event: VNCPointerEvent) => void;
  requestUpdate: (incremental?: boolean) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  error: string | null;
  loading: boolean;
}
```

### VNCViewer Component

Ready-to-use React component with built-in UI.

```typescript
<VNCViewer
  url="ws://localhost:6080"
  autoConnect={true}
  showStatus={true}
  className="my-vnc-viewer"
  style={{ width: '100%', height: '500px' }}
/>
```

#### Props

All `VNCClientOptions` plus:

- `className?: string` - Custom CSS class
- `style?: React.CSSProperties` - Custom styles
- `showStatus?: boolean` - Show connection status (default: true)
- `showLoading?: boolean` - Show loading indicator (default: true)
- `disableKeyboard?: boolean` - Disable keyboard input
- `disableMouse?: boolean` - Disable mouse input
- `autoFocus?: boolean` - Auto-focus canvas (default: true)
- `connectButtonText?: string` - Custom connect button text
- `disconnectButtonText?: string` - Custom disconnect button text

## Events

The VNC client emits the following events:

- `connecting` - Connection attempt started
- `connected` - Successfully connected
- `disconnected` - Connection closed
- `error` - Connection or protocol error
- `framebuffer-update` - Screen update received
- `server-cut-text` - Clipboard data from server
- `bell` - Bell/beep from server
- `resize` - Server resolution changed

## Advanced Usage

### Custom Authentication

```typescript
const client = new VNCClient({
  url: 'ws://localhost:6080',
  username: 'admin',
  password: 'secretpassword'
});
```

### High Quality Mode

```typescript
const client = new VNCClient({
  url: 'ws://localhost:6080',
  quality: 9,        // Highest quality
  compression: 0     // No compression
});
```

### Mobile/Touch Support

```typescript
<VNCViewer
  url="ws://localhost:6080"
  scale={0.5}        // Scale down for mobile
  autoResize={true}  // Auto-resize to fit
  disableKeyboard={true}  // Disable for touch-only
/>
```

## Server Setup

This library connects to VNC servers via WebSocket. You'll need a WebSocket-to-VNC proxy such as:

- [websockify](https://github.com/novnc/websockify)
- [noVNC proxy](https://github.com/novnc/noVNC)
- Custom WebSocket proxy

Example with websockify:

```bash
# Install websockify
pip install websockify

# Start proxy (connects WS port 6080 to VNC port 5900)
websockify 6080 localhost:5900
```

## Browser Compatibility

- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Node.js Compatibility

- Node.js 16+
- Bun 1.0+

## Development

```bash
# Clone repository
git clone https://github.com/sepandy/react-vnc-lib.git
cd react-vnc-lib

# Install dependencies
npm install

# Start development mode
npm run dev

# Build library
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes.

## Support

- 📖 [Documentation](https://github.com/sepandy/react-vnc-lib#readme)
- 🐛 [Issue Tracker](https://github.com/sepandy/react-vnc-lib/issues)
- 💬 [Discussions](https://github.com/sepandy/react-vnc-lib/discussions)

## Acknowledgments

- Inspired by [noVNC](https://github.com/novnc/noVNC)
- Built with modern TypeScript and React best practices 