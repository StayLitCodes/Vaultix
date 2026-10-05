import zlib from 'node:zlib';

/** Minimal, structurally valid image fixtures used by the avatar upload tests. */

let crcTable: number[] | null = null;

function getCrcTable(): number[] {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable.push(c >>> 0);
    }
  }
  return crcTable;
}

function crc32(buffer: Buffer): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = table[(crc ^ buffer[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/** A 1x1 RGB PNG. */
export function createPngBuffer(): Buffer {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = zlib.deflateSync(Buffer.from([0x00, 0xff, 0x00, 0x00]));

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** PNG magic bytes followed by corrupted data (no valid chunk structure). */
export function createMalformedPngBuffer(): Buffer {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  return Buffer.concat([signature, Buffer.alloc(64, 0xab)]);
}

/** A 1x1 GIF89a. */
export function createGifBuffer(): Buffer {
  const header = Buffer.from('GIF89a', 'ascii');
  const screenDescriptor = Buffer.alloc(7);
  screenDescriptor.writeUInt16LE(1, 0);
  screenDescriptor.writeUInt16LE(1, 2);
  return Buffer.concat([header, screenDescriptor, Buffer.from([0x3b])]);
}

/** A baseline JPEG with an SOF0 frame header, a scan and an EOI marker. */
export function createJpegBuffer(): Buffer {
  const app0 = Buffer.concat([
    Buffer.from([0xff, 0xe0]),
    lengthPrefixed(
      Buffer.concat([
        Buffer.from('JFIF\0', 'ascii'),
        Buffer.from([0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
      ]),
    ),
  ]);

  const dqt = Buffer.concat([
    Buffer.from([0xff, 0xdb]),
    lengthPrefixed(Buffer.concat([Buffer.from([0x00]), Buffer.alloc(64, 0x10)])),
  ]);

  const frameHeaderData = Buffer.alloc(15);
  frameHeaderData[0] = 0x08;
  frameHeaderData.writeUInt16BE(1, 1);
  frameHeaderData.writeUInt16BE(1, 3);
  frameHeaderData[5] = 0x03;
  const sof0 = Buffer.concat([
    Buffer.from([0xff, 0xc0]),
    lengthPrefixed(frameHeaderData),
  ]);

  const scanData = Buffer.alloc(13);
  scanData[0] = 0x03;
  scanData[10] = 0x00;
  scanData[11] = 0x3f;
  scanData[12] = 0x00;
  const sos = Buffer.concat([
    Buffer.from([0xff, 0xda]),
    lengthPrefixed(scanData),
  ]);

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    app0,
    dqt,
    sof0,
    sos,
    Buffer.from([0x12, 0x34, 0x56]),
    Buffer.from([0xff, 0xd9]),
  ]);
}

function lengthPrefixed(data: Buffer): Buffer {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(data.length + 2, 0);
  return Buffer.concat([length, data]);
}

/** A lossless WebP container. */
export function createWebpBuffer(): Buffer {
  const payload = Buffer.concat([Buffer.from([0x2f]), Buffer.alloc(9, 0x00)]);
  const chunk = Buffer.concat([
    Buffer.from('VP8L', 'ascii'),
    uint32LE(payload.length),
    payload,
  ]);
  const header = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    uint32LE(chunk.length + 4),
    Buffer.from('WEBP', 'ascii'),
  ]);
  return Buffer.concat([header, chunk]);
}

function uint32LE(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value, 0);
  return buffer;
}

/** Plain text pretending to be an image. */
export function createTextBuffer(): Buffer {
  return Buffer.from('not an image at all, just text', 'utf8');
}
