import { VNCPixelFormat, VNCServerInitMessage } from '../types/vnc';

export class VNCProtocolUtils {
  /**
   * Convert string to Uint8Array
   */
  static stringToUint8Array(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  /**
   * Convert Uint8Array to string
   */
  static uint8ArrayToString(arr: Uint8Array): string {
    return new TextDecoder().decode(arr);
  }

  /**
   * Read uint8 from buffer at offset
   */
  static readUint8(buffer: ArrayBuffer, offset: number): number {
    return new DataView(buffer).getUint8(offset);
  }

  /**
   * Read uint16 big endian from buffer at offset
   */
  static readUint16BE(buffer: ArrayBuffer, offset: number): number {
    return new DataView(buffer).getUint16(offset, false);
  }

  /**
   * Read uint32 big endian from buffer at offset
   */
  static readUint32BE(buffer: ArrayBuffer, offset: number): number {
    return new DataView(buffer).getUint32(offset, false);
  }

  /**
   * Write uint8 to buffer at offset
   */
  static writeUint8(buffer: ArrayBuffer, offset: number, value: number): void {
    new DataView(buffer).setUint8(offset, value);
  }

  /**
   * Write uint16 big endian to buffer at offset
   */
  static writeUint16BE(buffer: ArrayBuffer, offset: number, value: number): void {
    new DataView(buffer).setUint16(offset, value, false);
  }

  /**
   * Write uint32 big endian to buffer at offset
   */
  static writeUint32BE(buffer: ArrayBuffer, offset: number, value: number): void {
    new DataView(buffer).setUint32(offset, value, false);
  }

  /**
   * Parse VNC server init message
   */
  static parseServerInit(data: ArrayBuffer): VNCServerInitMessage {
    const view = new DataView(data);
    
    const width = view.getUint16(0, false);
    const height = view.getUint16(2, false);
    
    const pixelFormat: VNCPixelFormat = {
      bitsPerPixel: view.getUint8(4),
      depth: view.getUint8(5),
      bigEndian: view.getUint8(6) === 1,
      trueColor: view.getUint8(7) === 1,
      redMax: view.getUint16(8, false),
      greenMax: view.getUint16(10, false),
      blueMax: view.getUint16(12, false),
      redShift: view.getUint8(14),
      greenShift: view.getUint8(15),
      blueShift: view.getUint8(16)
    };

    const nameLength = view.getUint32(20, false);
    const nameBytes = new Uint8Array(data, 24, nameLength);
    const name = this.uint8ArrayToString(nameBytes);

    return {
      width,
      height,
      pixelFormat,
      name
    };
  }

  /**
   * Create client init message
   */
  static createClientInit(shared: boolean = true): ArrayBuffer {
    const buffer = new ArrayBuffer(1);
    this.writeUint8(buffer, 0, shared ? 1 : 0);
    return buffer;
  }

  /**
   * Create set pixel format message
   */
  static createSetPixelFormat(pixelFormat: VNCPixelFormat): ArrayBuffer {
    const buffer = new ArrayBuffer(20);
    const view = new DataView(buffer);
    
    view.setUint8(0, 0); // message type
    view.setUint8(1, 0); // padding
    view.setUint8(2, 0); // padding
    view.setUint8(3, 0); // padding
    
    view.setUint8(4, pixelFormat.bitsPerPixel);
    view.setUint8(5, pixelFormat.depth);
    view.setUint8(6, pixelFormat.bigEndian ? 1 : 0);
    view.setUint8(7, pixelFormat.trueColor ? 1 : 0);
    view.setUint16(8, pixelFormat.redMax, false);
    view.setUint16(10, pixelFormat.greenMax, false);
    view.setUint16(12, pixelFormat.blueMax, false);
    view.setUint8(14, pixelFormat.redShift);
    view.setUint8(15, pixelFormat.greenShift);
    view.setUint8(16, pixelFormat.blueShift);
    
    return buffer;
  }

  /**
   * Create framebuffer update request
   */
  static createFramebufferUpdateRequest(
    incremental: boolean,
    x: number,
    y: number,
    width: number,
    height: number
  ): ArrayBuffer {
    const buffer = new ArrayBuffer(10);
    const view = new DataView(buffer);
    
    view.setUint8(0, 3); // message type
    view.setUint8(1, incremental ? 1 : 0);
    view.setUint16(2, x, false);
    view.setUint16(4, y, false);
    view.setUint16(6, width, false);
    view.setUint16(8, height, false);
    
    return buffer;
  }

  /**
   * Create key event message
   */
  static createKeyEvent(down: boolean, key: number): ArrayBuffer {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    
    view.setUint8(0, 4); // message type
    view.setUint8(1, down ? 1 : 0);
    view.setUint16(2, 0, false); // padding
    view.setUint32(4, key, false);
    
    return buffer;
  }

  /**
   * Create pointer event message
   */
  static createPointerEvent(buttonMask: number, x: number, y: number): ArrayBuffer {
    const buffer = new ArrayBuffer(6);
    const view = new DataView(buffer);
    
    view.setUint8(0, 5); // message type
    view.setUint8(1, buttonMask);
    view.setUint16(2, x, false);
    view.setUint16(4, y, false);
    
    return buffer;
  }

  /**
   * Get default pixel format (32-bit RGBA)
   */
  static getDefaultPixelFormat(): VNCPixelFormat {
    return {
      bitsPerPixel: 32,
      depth: 24,
      bigEndian: false,
      trueColor: true,
      redMax: 255,
      greenMax: 255,
      blueMax: 255,
      redShift: 0,
      greenShift: 8,
      blueShift: 16
    };
  }
} 