import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'm4b', 'wma', 'opus', 'webm', 'aiff',
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ts',
  'vob', 'ogv', 'divx', 'xvid', 'rm', 'rmvb', 'asf', 'f4v', 'mts', 'm2ts', 'tp', 'trp',
  'h264', 'h265', 'hevc', '264', '265', 'ts', 'mpe', 'mpv', 'm2v', 'm4p', 'f4p',
]);

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif', 'avif', 'heic', 'heif',
  'raw', 'cr2', 'nef', 'orf', 'dng',
]);

const MEDIA_MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.m4b': 'audio/mp4',
  '.wma': 'audio/x-ms-wma',
  '.opus': 'audio/opus',
  '.webm': 'audio/webm',
  '.aiff': 'audio/aiff',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
  '.m4v': 'video/mp4',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.3gp': 'video/3gpp',
  '.ts': 'video/mp2t',
  '.vob': 'video/dvd',
  '.ogv': 'video/ogg',
  '.divx': 'video/x-msvideo',
  '.xvid': 'video/x-msvideo',
  '.rm': 'application/vnd.rn-realmedia',
  '.rmvb': 'application/vnd.rn-realmedia-vbr',
  '.asf': 'video/x-ms-asf',
  '.f4v': 'video/mp4',
  '.mts': 'video/mp2t',
  '.m2ts': 'video/mp2t',
  '.tp': 'video/mp2t',
  '.trp': 'video/mp2t',
  '.h264': 'video/mp4',
  '.h265': 'video/mp4',
  '.hevc': 'video/mp4',
  '.264': 'video/mp4',
  '.265': 'video/mp4',
  '.mpe': 'video/mpeg',
  '.mpv': 'video/mpeg',
  '.m2v': 'video/mpeg',
  '.m4p': 'video/mp4',
  '.f4p': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dirPath = searchParams.get('path') || '/home/z';
  const mediaType = searchParams.get('type') || 'audio';
  const range = request.headers.get('range');

  try {
    const normalized = path.normalize(dirPath);
    if (normalized.includes('..')) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
    }

    if (!fs.existsSync(normalized)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const stat = fs.statSync(normalized);

    // If it's a file, stream it
    if (stat.isFile()) {
      const ext = path.extname(normalized).toLowerCase();
      const mimeType = MEDIA_MIME_TYPES[ext] || 'application/octet-stream';
      const fileSize = stat.size;

      // Handle range requests for seeking (video/audio)
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const file = fs.createReadStream(normalized, { start, end });
        let controllerClosed = false;

        const readableStream = new ReadableStream({
          start(controller) {
            file.on('data', (chunk) => {
              if (controllerClosed) return;
              try {
                controller.enqueue(new Uint8Array(chunk));
              } catch {
                // controller already closed, ignore
              }
            });
            file.on('end', () => {
              if (!controllerClosed) {
                controllerClosed = true;
                try { controller.close(); } catch { /* ignore */ }
              }
            });
            file.on('error', (err) => {
              if (!controllerClosed) {
                controllerClosed = true;
                try { controller.error(err); } catch { /* ignore */ }
              }
            });
          },
          cancel() {
            // Browser cancelled the request (e.g. user seeked, navigated away)
            controllerClosed = true;
            file.destroy();
          },
        });

        return new NextResponse(readableStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }

      // Full file response - stream instead of buffering entire file
      const file = fs.createReadStream(normalized);
      let controllerClosed = false;

      const readableStream = new ReadableStream({
        start(controller) {
          file.on('data', (chunk) => {
            if (controllerClosed) return;
            try {
              controller.enqueue(new Uint8Array(chunk));
            } catch { /* ignore */ }
          });
          file.on('end', () => {
            if (!controllerClosed) {
              controllerClosed = true;
              try { controller.close(); } catch { /* ignore */ }
            }
          });
          file.on('error', (err) => {
            if (!controllerClosed) {
              controllerClosed = true;
              try { controller.error(err); } catch { /* ignore */ }
            }
          });
        },
        cancel() {
          controllerClosed = true;
          file.destroy();
        },
      });

      return new NextResponse(readableStream, {
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // If it's a directory, scan for media files and subdirectories
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const entries = fs.readdirSync(normalized, { withFileTypes: true });
    const allowedExts = mediaType === 'video' ? VIDEO_EXTENSIONS : mediaType === 'image' ? IMAGE_EXTENSIONS : AUDIO_EXTENSIONS;

    const folders: Array<{ name: string; path: string; itemCount: number; subFolderCount: number }> = [];
    const files: Array<{ name: string; path: string; size: number; modifiedAt: string; extension: string }> = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(normalized, entry.name);

      try {
        const itemStat = fs.statSync(fullPath);
        if (entry.isDirectory()) {
          // Count media items in subdirectory
          let count = 0;
          let subCount = 0;
          try {
            const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
            for (const sub of subEntries) {
              if (sub.name.startsWith('.')) continue;
              if (sub.isDirectory()) {
                subCount++;
              } else {
                const subExt = path.extname(sub.name).toLowerCase().replace('.', '');
                if (allowedExts.has(subExt)) count++;
              }
            }
          } catch { /* skip */ }
          folders.push({ name: entry.name, path: fullPath, itemCount: count, subFolderCount: subCount });
        } else {
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          if (allowedExts.has(ext)) {
            files.push({
              name: entry.name,
              path: fullPath,
              size: itemStat.size,
              modifiedAt: itemStat.mtime.toISOString(),
              extension: ext,
            });
          }
        }
      } catch { /* skip inaccessible files */ }
    }

    // Sort folders first, then files alphabetically
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate total size and count
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const totalDurationEstimate = files.length > 0 ? Math.round(totalSize / (5 * 1024 * 1024)) : 0; // rough estimate

    return NextResponse.json({
      path: normalized,
      parentPath: path.dirname(normalized),
      folders,
      files,
      totalFiles: files.length,
      totalFolders: folders.length,
      totalSize,
      estimatedDuration: totalDurationEstimate,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read media', details: String(error) },
      { status: 500 }
    );
  }
}
