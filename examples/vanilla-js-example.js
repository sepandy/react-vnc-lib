// Vanilla JavaScript Example
import { VNCClient } from 'react-vnc-lib';

// Create VNC client instance
const client = new VNCClient({
  url: 'ws://localhost:6080',
  username: 'user',
  password: 'password',
  debug: true,
  scale: 1.0,
  quality: 6
});

// Set up event listeners
client.on('connecting', () => {
  console.log('Connecting to VNC server...');
  updateStatus('Connecting...');
});

client.on('connected', () => {
  console.log('Connected to VNC server');
  updateStatus('Connected');
  
  // Request initial framebuffer update
  client.requestFramebufferUpdate(false);
});

client.on('disconnected', () => {
  console.log('Disconnected from VNC server');
  updateStatus('Disconnected');
});

client.on('error', (event) => {
  console.error('VNC Error:', event.data.message);
  updateStatus(`Error: ${event.data.message}`);
});

client.on('framebuffer-update', (event) => {
  console.log('Received framebuffer update');
  // Handle framebuffer data here
  // event.data contains ImageData that can be drawn to canvas
});

// DOM manipulation functions
function updateStatus(status) {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = status;
  }
}

// Connect button handler
document.getElementById('connect-btn')?.addEventListener('click', async () => {
  try {
    await client.connect();
  } catch (error) {
    console.error('Failed to connect:', error);
  }
});

// Disconnect button handler
document.getElementById('disconnect-btn')?.addEventListener('click', () => {
  client.disconnect();
});

// Keyboard event handling
document.addEventListener('keydown', (event) => {
  if (client.getState().connected) {
    client.sendKeyEvent({
      key: event.key,
      code: event.code,
      down: true,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    });
  }
});

document.addEventListener('keyup', (event) => {
  if (client.getState().connected) {
    client.sendKeyEvent({
      key: event.key,
      code: event.code,
      down: false,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    });
  }
});

// Mouse event handling for canvas
const canvas = document.getElementById('vnc-canvas');
if (canvas) {
  canvas.addEventListener('mousedown', (event) => {
    if (client.getState().connected) {
      const rect = canvas.getBoundingClientRect();
      client.sendPointerEvent({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        buttons: event.buttons
      });
    }
  });

  canvas.addEventListener('mousemove', (event) => {
    if (client.getState().connected) {
      const rect = canvas.getBoundingClientRect();
      client.sendPointerEvent({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        buttons: event.buttons
      });
    }
  });

  canvas.addEventListener('mouseup', (event) => {
    if (client.getState().connected) {
      const rect = canvas.getBoundingClientRect();
      client.sendPointerEvent({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        buttons: 0
      });
    }
  });
} 