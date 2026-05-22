import fs from 'fs/promises';
import path from 'path';

const allowedMimeTypes = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const allowedExtensions = new Set(['.pdf', '.png', '.jpg', '.jpeg']);

export function isAllowedUploadMetadata(file) {
  const extension = path.extname(file?.originalname || '').toLowerCase();
  return allowedExtensions.has(extension) && allowedMimeTypes.has(file?.mimetype);
}

export async function validateUploadSignature(filePath, mimeType) {
  const header = await readHeader(filePath);

  if (mimeType === 'application/pdf' && header.subarray(0, 4).toString() === '%PDF') {
    return true;
  }

  if (
    mimeType === 'image/png' &&
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return true;
  }

  if (
    mimeType === 'image/jpeg' &&
    header.length >= 3 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff
  ) {
    return true;
  }

  return false;
}

async function readHeader(filePath) {
  const fileHandle = await fs.open(filePath, 'r');

  try {
    const buffer = Buffer.alloc(8);
    const result = await fileHandle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, result.bytesRead);
  } finally {
    await fileHandle.close();
  }
}
