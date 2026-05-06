import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const BOOK_EXTENSIONS = new Set([
  'pdf', 'epub', 'mobi', 'djvu', 'cbz', 'cbr', 'azw3', 'fb2', 'txt', 'rtf', 'doc', 'docx',
]);

const AUDIOBOOK_EXTENSIONS = new Set([
  'mp3', 'm4a', 'm4b', 'wav', 'ogg', 'flac', 'aac', 'wma', 'opus',
]);

const ALL_EXTENSIONS = new Set([...BOOK_EXTENSIONS, ...AUDIOBOOK_EXTENSIONS]);

// Extensions that can be viewed inline in the browser
const VIEWABLE_EXTENSIONS = new Set(['pdf', 'txt']);

const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'm4b', 'wav', 'ogg', 'flac', 'aac', 'wma', 'opus']);

const bookMimeTypes: Record<string, string> = {
  'pdf': 'application/pdf',
  'epub': 'application/epub+zip',
  'mobi': 'application/x-mobipocket-ebook',
  'djvu': 'image/vnd.djvu',
  'cbz': 'application/x-cbz',
  'cbr': 'application/x-cbr',
  'azw3': 'application/vnd.amazon.ebook',
  'fb2': 'application/x-fictionbook+xml',
  'txt': 'text/plain; charset=utf-8',
  'rtf': 'application/rtf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'mp3': 'audio/mpeg',
  'm4a': 'audio/mp4',
  'm4b': 'audio/mp4',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'flac': 'audio/flac',
  'aac': 'audio/aac',
  'wma': 'audio/x-ms-wma',
  'opus': 'audio/opus',
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dirPath = searchParams.get('path') || '/mnt/Canal';
  const inline = searchParams.get('inline') === 'true';

  try {
    const normalized = path.normalize(dirPath);
    if (normalized.includes('..')) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
    }

    if (!fs.existsSync(normalized)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const stat = fs.statSync(normalized);

    if (stat.isFile()) {
      const ext = path.extname(normalized).toLowerCase().replace('.', '');
      const fileName = path.basename(normalized);
      const mimeType = bookMimeTypes[ext] || 'application/octet-stream';
      const isAudio = AUDIO_EXTENSIONS.has(ext);

      // Support range requests for audio files
      const range = request.headers.get('range');

      if (range && isAudio) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        const file = fs.createReadStream(normalized, { start, end });
        let controllerClosed = false;

        const readableStream = new ReadableStream({
          start(controller) {
            file.on('data', (chunk) => {
              if (controllerClosed) return;
              try { controller.enqueue(new Uint8Array(chunk)); } catch { /* ignore */ }
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
          status: 206,
          headers: {
            'Content-Type': mimeType,
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }

      // Use streaming for all files
      const file = fs.createReadStream(normalized);
      let controllerClosed = false;

      const readableStream = new ReadableStream({
        start(controller) {
          file.on('data', (chunk) => {
            if (controllerClosed) return;
            try { controller.enqueue(new Uint8Array(chunk)); } catch { /* ignore */ }
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

      // For audio files, always serve inline so the browser audio player works
      const disposition = (inline && VIEWABLE_EXTENSIONS.has(ext)) || isAudio
        ? 'inline'
        : `attachment; filename="${encodeURIComponent(fileName)}"`;

      return new NextResponse(readableStream, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': disposition,
          'Content-Length': String(stat.size),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    if (!stat.isDirectory()) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Scan directory for book files, audiobooks, and subdirectories
    const entries = fs.readdirSync(normalized, { withFileTypes: true });

    const folders: Array<{ name: string; path: string; itemCount: number; subFolderCount: number }> = [];
    const files: Array<{ name: string; path: string; size: number; modifiedAt: string; extension: string; isAudiobook: boolean }> = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(normalized, entry.name);

      try {
        const itemStat = fs.statSync(fullPath);
        if (entry.isDirectory()) {
          // Count book/audiobook items in subdirectory
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
                if (ALL_EXTENSIONS.has(subExt)) count++;
              }
            }
          } catch { /* skip */ }
          folders.push({ name: entry.name, path: fullPath, itemCount: count, subFolderCount: subCount });
        } else {
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          if (ALL_EXTENSIONS.has(ext)) {
            files.push({
              name: entry.name,
              path: fullPath,
              size: itemStat.size,
              modifiedAt: itemStat.mtime.toISOString(),
              extension: ext,
              isAudiobook: AUDIOBOOK_EXTENSIONS.has(ext),
            });
          }
        }
      } catch { /* skip inaccessible files */ }
    }

    // Sort folders first, then files alphabetically
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    return NextResponse.json({
      path: normalized,
      parentPath: path.dirname(normalized),
      folders,
      files,
      totalFiles: files.length,
      totalFolders: folders.length,
      totalSize,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to scan books', details: String(error) },
      { status: 500 }
    );
  }
}
