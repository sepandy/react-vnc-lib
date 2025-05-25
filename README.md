# React VNC Lib

[![npm version](https://badge.fury.io/js/react-vnc-lib.svg)](https://badge.fury.io/js/react-vnc-lib)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, lightweight VNC client library for React, Next.js, Node.js, and Bun with TypeScript support. Designed with minimal dependencies and maximum compatibility.

## Features

- 🚀 **Modern TypeScript** - Full type safety and modern ES2020+ features
- ⚡ **Minimal Dependencies** - Zero runtime dependencies, React as optional peer dependency
- 🌐 **Universal Compatibility** - Works with React, Next.js, Node.js, and Bun
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
git clone https://github.com/yourusername/react-vnc-lib.git
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

- 📖 [Documentation](https://github.com/yourusername/react-vnc-lib#readme)
- 🐛 [Issue Tracker](https://github.com/yourusername/react-vnc-lib/issues)
- 💬 [Discussions](https://github.com/yourusername/react-vnc-lib/discussions)

## Acknowledgments

- Inspired by [noVNC](https://github.com/novnc/noVNC)
- Built with modern TypeScript and React best practices 