// Jest setup file to polyfill missing browser APIs
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder and TextDecoder for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any; 