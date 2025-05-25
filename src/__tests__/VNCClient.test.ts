import { VNCClient } from '../core/VNCClient';
import { VNCProtocolUtils } from '../utils/protocol';

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1,
  OPEN: 1,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
})) as any;

describe('VNCClient', () => {
  let client: VNCClient;

  beforeEach(() => {
    client = new VNCClient({
      url: 'ws://localhost:6080',
      debug: false
    });
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('constructor', () => {
    it('should create a client with default options', () => {
      expect(client).toBeInstanceOf(VNCClient);
      const state = client.getState();
      expect(state.connected).toBe(false);
      expect(state.connecting).toBe(false);
    });

    it('should handle custom options', () => {
      const customClient = new VNCClient({
        url: 'ws://example.com:6080',
        username: 'test',
        password: 'pass',
        viewOnly: true,
        quality: 9,
        debug: true
      });

      expect(customClient).toBeInstanceOf(VNCClient);
    });
  });

  describe('state management', () => {
    it('should return initial state', () => {
      const state = client.getState();
      expect(state).toEqual({
        connected: false,
        connecting: false,
        error: null,
        serverName: null,
        width: 0,
        height: 0
      });
    });
  });

  describe('event handling', () => {
    it('should add and remove event listeners', () => {
      const handler = jest.fn();
      
      client.on('connected', handler);
      // Simulate event
      (client as any).emit('connected');
      expect(handler).toHaveBeenCalled();

      client.off('connected', handler);
      handler.mockClear();
      
      // Simulate event again
      (client as any).emit('connected');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('input events', () => {
    beforeEach(() => {
      // Mock connected state
      (client as any).setState({ connected: true });
    });

    it('should send key events when connected', () => {
      const sendMessageSpy = jest.spyOn(client as any, 'sendMessage');
      
      client.sendKeyEvent({
        key: 'a',
        code: 'KeyA',
        down: true
      });

      expect(sendMessageSpy).toHaveBeenCalled();
    });

    it('should send pointer events when connected', () => {
      const sendMessageSpy = jest.spyOn(client as any, 'sendMessage');
      
      client.sendPointerEvent({
        x: 100,
        y: 100,
        buttons: 1
      });

      expect(sendMessageSpy).toHaveBeenCalled();
    });

    it('should not send events when disconnected', () => {
      (client as any).setState({ connected: false });
      const sendMessageSpy = jest.spyOn(client as any, 'sendMessage');
      
      client.sendKeyEvent({
        key: 'a',
        code: 'KeyA',
        down: true
      });

      expect(sendMessageSpy).not.toHaveBeenCalled();
    });
  });
});

describe('VNCProtocolUtils', () => {
  describe('string conversion', () => {
    it('should convert string to Uint8Array', () => {
      const result = VNCProtocolUtils.stringToUint8Array('hello');
      expect(result.constructor.name).toBe('Uint8Array');
      expect(result.length).toBe(5);
    });

    it('should convert Uint8Array to string', () => {
      const bytes = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
      const result = VNCProtocolUtils.uint8ArrayToString(bytes);
      expect(result).toBe('hello');
    });
  });

  describe('binary data handling', () => {
    it('should read uint8 from buffer', () => {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setUint8(0, 255);
      
      const result = VNCProtocolUtils.readUint8(buffer, 0);
      expect(result).toBe(255);
    });

    it('should read uint16 big endian from buffer', () => {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setUint16(0, 0x1234, false); // big endian
      
      const result = VNCProtocolUtils.readUint16BE(buffer, 0);
      expect(result).toBe(0x1234);
    });

    it('should read uint32 big endian from buffer', () => {
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setUint32(0, 0x12345678, false); // big endian
      
      const result = VNCProtocolUtils.readUint32BE(buffer, 0);
      expect(result).toBe(0x12345678);
    });
  });

  describe('message creation', () => {
    it('should create client init message', () => {
      const buffer = VNCProtocolUtils.createClientInit(true);
      expect(buffer.byteLength).toBe(1);
      
      const view = new DataView(buffer);
      expect(view.getUint8(0)).toBe(1);
    });

    it('should create framebuffer update request', () => {
      const buffer = VNCProtocolUtils.createFramebufferUpdateRequest(
        true, 0, 0, 800, 600
      );
      expect(buffer.byteLength).toBe(10);
      
      const view = new DataView(buffer);
      expect(view.getUint8(0)).toBe(3); // message type
      expect(view.getUint8(1)).toBe(1); // incremental
    });

    it('should create key event message', () => {
      const buffer = VNCProtocolUtils.createKeyEvent(true, 65); // 'A'
      expect(buffer.byteLength).toBe(8);
      
      const view = new DataView(buffer);
      expect(view.getUint8(0)).toBe(4); // message type
      expect(view.getUint8(1)).toBe(1); // down
      expect(view.getUint32(4, false)).toBe(65); // key code
    });

    it('should create pointer event message', () => {
      const buffer = VNCProtocolUtils.createPointerEvent(1, 100, 200);
      expect(buffer.byteLength).toBe(6);
      
      const view = new DataView(buffer);
      expect(view.getUint8(0)).toBe(5); // message type
      expect(view.getUint8(1)).toBe(1); // button mask
      expect(view.getUint16(2, false)).toBe(100); // x
      expect(view.getUint16(4, false)).toBe(200); // y
    });
  });

  describe('pixel format', () => {
    it('should return default pixel format', () => {
      const pixelFormat = VNCProtocolUtils.getDefaultPixelFormat();
      
      expect(pixelFormat.bitsPerPixel).toBe(32);
      expect(pixelFormat.depth).toBe(24);
      expect(pixelFormat.bigEndian).toBe(false);
      expect(pixelFormat.trueColor).toBe(true);
      expect(pixelFormat.redMax).toBe(255);
      expect(pixelFormat.greenMax).toBe(255);
      expect(pixelFormat.blueMax).toBe(255);
    });
  });
}); 