import { NextResponse } from 'next/server';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';

// ── Extension sets (mirrors /api/media/stream) ──────────────────────────────

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'm4b', 'wma', 'opus', 'webm', 'aiff',
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ts',
  'vob', 'ogv', 'divx', 'xvid', 'rm', 'rmvb', 'asf', 'f4v', 'mts', 'm2ts', 'tp', 'trp',
]);

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif', 'avif', 'heic', 'heif',
  'raw', 'cr2', 'nef', 'orf', 'dng',
]);

// ── In-memory cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  data: Record<string, unknown>;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache: CacheEntry | null = null;
let cacheData: CacheEntry | null = null;

function getCached(): CacheEntry['data'] | null {
  if (cacheData && Date.now() - cacheData.timestamp < CACHE_TTL) {
    return cacheData.data;
  }
  return null;
}

function setCached(data: CacheEntry['data']) {
  cacheData = { data, timestamp: Date.now() };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const MAX_DEPTH = 8;

/**
 * Recursively scan a directory tree asynchronously.
 * Limits depth to prevent extreme recursion on large filesystems.
 */
async function scanDirectory(
  dir: string,
  allowedExts: Set<string>,
  depth: number = 0,
): Promise<{ totalFiles: number; totalFolders: number; totalSize: number }> {
  let totalFiles = 0;
  let totalFolders = 0;
  let totalSize = 0;

  if (depth > MAX_DEPTH) return { totalFiles, totalFolders, totalSize };

  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });

    const subScanPromises: Promise<{ totalFiles: number; totalFolders: number; totalSize: number }>[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(dir, entry.name);

      try {
        if (entry.isDirectory()) {
          totalFolders++;
          subScanPromises.push(scanDirectory(fullPath, allowedExts, depth + 1));
        } else {
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          if (allowedExts.has(ext)) {
            totalFiles++;
            try {
              const stat = await fsp.stat(fullPath);
              totalSize += stat.size;
            } catch {
              // skip stat errors
            }
          }
        }
      } catch {
        // skip inaccessible entries
      }
    }

    // Process subdirectories in parallel batches
    if (subScanPromises.length > 0) {
      const results = await Promise.all(subScanPromises);
      for (const sub of results) {
        totalFiles += sub.totalFiles;
        totalFolders += sub.totalFolders;
        totalSize += sub.totalSize;
      }
    }
  } catch {
    // skip inaccessible root
  }

  return { totalFiles, totalFolders, totalSize };
}

/**
 * Aggregate scans across multiple library paths.
 */
async function aggregatePaths(dirs: string[], allowedExts: Set<string>) {
  let totalFiles = 0;
  let totalFolders = 0;
  let totalSize = 0;

  const scanPromises = dirs.map(async (dir) => {
    const norm = path.normalize(dir);
    try {
      await fsp.access(norm);
    } catch {
      return { totalFiles: 0, totalFolders: 0, totalSize: 0 };
    }
    return scanDirectory(norm, allowedExts);
  });

  const results = await Promise.all(scanPromises);
  for (const result of results) {
    totalFiles += result.totalFiles;
    totalFolders += result.totalFolders;
    totalSize += result.totalSize;
  }

  return { totalFiles, totalFolders, totalSize };
}

/**
 * Read a JSON-array setting from the database.
 * Returns `fallback` when the setting is missing or malformed.
 */
async function getJsonArraySetting(key: string, fallback: string[]): Promise<string[]> {
  try {
    const row = await db.setting.findUnique({ where: { key } });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // malformed JSON – fall through
  }
  return fallback;
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Return cached data if still fresh
    const cached = getCached();
    if (cached) {
      return NextResponse.json(cached);
    }

    // 1. Read configured library paths (or use defaults)
    const [musicPaths, moviePaths, imagePaths] = await Promise.all([
      getJsonArraySetting('musicLibraryPaths', ['/home/z']),
      getJsonArraySetting('movieLibraryPaths', ['/home/z']),
      getJsonArraySetting('imageLibraryPaths', ['/mnt/Canal', '/mnt/Tools']),
    ]);

    // 2. Scan all configured paths in parallel
    const [music, movies, images] = await Promise.all([
      aggregatePaths(musicPaths, AUDIO_EXTENSIONS),
      aggregatePaths(moviePaths, VIDEO_EXTENSIONS),
      aggregatePaths(imagePaths, IMAGE_EXTENSIONS),
    ]);

    // 3. Library stats from database
    const [totalBooks, booksRead, totalPagesResult, uniqueAuthorsResult] = await Promise.all([
      db.book.count(),
      db.book.count({ where: { status: 'Leído' } }),
      db.book.aggregate({ _sum: { pages: true } }),
      db.book.groupBy({ by: ['author'] }),
    ]);

    const library = {
      totalBooks,
      booksRead,
      totalPages: totalPagesResult._sum.pages ?? 0,
      uniqueAuthors: uniqueAuthorsResult.length,
    };

    const result = { library, music, movies, images };

    // Cache the result
    setCached(result);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats', details: String(error) },
      { status: 500 },
    );
  }
}
