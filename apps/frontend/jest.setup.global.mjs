import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream, WritableStream, TransformStream } from 'stream/web';
import { BroadcastChannel } from 'worker_threads';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

if (!global.ReadableStream) {
  global.ReadableStream = ReadableStream;
}
if (!global.WritableStream) {
  global.WritableStream = WritableStream;
}
if (!global.TransformStream) {
  global.TransformStream = TransformStream;
}

if (!global.BroadcastChannel) {
  global.BroadcastChannel = BroadcastChannel;
}
