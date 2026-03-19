import { promises as fs } from 'fs';
import path from 'path';
import { inflateRawSync } from 'zlib';

type CentralFileHeader = {
  fileName: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
};

export async function unzipToDirectory(zipBuffer: Buffer, outDir: string): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });
  const entries = parseCentralDirectory(zipBuffer);
  for (const entry of entries) {
    const normalized = safeZipPath(entry.fileName);
    if (!normalized) {
      continue;
    }
    const targetPath = path.join(outDir, normalized);
    if (entry.fileName.endsWith('/')) {
      await fs.mkdir(targetPath, { recursive: true });
      continue;
    }
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const fileData = extractFileData(zipBuffer, entry);
    await fs.writeFile(targetPath, fileData);
  }
}

function safeZipPath(p: string): string | null {
  const replaced = p.replaceAll('\\', '/');
  const parts = replaced.split('/').filter((x) => x && x !== '.' && x !== '..');
  const normalized = parts.join('/');
  if (!normalized) {
    return null;
  }
  if (normalized.includes('..')) {
    return null;
  }
  return normalized;
}

function parseCentralDirectory(buf: Buffer): CentralFileHeader[] {
  const eocdSig = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i -= 1) {
    if (buf.readUInt32LE(i) === eocdSig) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error('invalid_zip: missing EOCD');
  }

  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  let cursor = cdOffset;

  const cdfhSig = 0x02014b50;
  const entries: CentralFileHeader[] = [];
  while (cursor < cdOffset + cdSize) {
    const sig = buf.readUInt32LE(cursor);
    if (sig !== cdfhSig) {
      break;
    }
    const compressionMethod = buf.readUInt16LE(cursor + 10);
    const compressedSize = buf.readUInt32LE(cursor + 20);
    const uncompressedSize = buf.readUInt32LE(cursor + 24);
    const fileNameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const localHeaderOffset = buf.readUInt32LE(cursor + 42);
    const fileName = buf.subarray(cursor + 46, cursor + 46 + fileNameLen).toString('utf8');
    entries.push({
      fileName,
      compressedSize,
      uncompressedSize,
      compressionMethod,
      localHeaderOffset,
    });
    cursor = cursor + 46 + fileNameLen + extraLen + commentLen;
  }
  return entries;
}

function extractFileData(buf: Buffer, entry: CentralFileHeader): Buffer {
  const lfhSig = 0x04034b50;
  const sig = buf.readUInt32LE(entry.localHeaderOffset);
  if (sig !== lfhSig) {
    throw new Error('invalid_zip: missing local header');
  }
  const fileNameLen = buf.readUInt16LE(entry.localHeaderOffset + 26);
  const extraLen = buf.readUInt16LE(entry.localHeaderOffset + 28);
  const dataOffset = entry.localHeaderOffset + 30 + fileNameLen + extraLen;
  const compressed = buf.subarray(dataOffset, dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return Buffer.from(compressed);
  }
  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressed);
  }
  throw new Error(`unsupported_zip_compression_method:${entry.compressionMethod}`);
}
