import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dirPath = searchParams.get('path') || '/home/z';

  try {
    // Security: normalize and validate path
    const normalized = path.normalize(dirPath);
    if (normalized.includes('..')) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
    }

    if (!fs.existsSync(normalized)) {
      return NextResponse.json({ error: 'Directory not found' }, { status: 404 });
    }

    const stat = fs.statSync(normalized);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: 'Not a directory' }, { status: 400 });
    }

    const entries = fs.readdirSync(normalized, { withFileTypes: true });

    const items = entries
      .map((entry) => {
        const fullPath = path.join(normalized, entry.name);
        try {
          const itemStat = fs.statSync(fullPath);
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size: entry.isDirectory() ? 0 : itemStat.size,
            modifiedAt: itemStat.mtime.toISOString(),
            extension: entry.isDirectory() ? undefined : path.extname(entry.name).toLowerCase(),
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Directories first
        if (a!.isDirectory && !b!.isDirectory) return -1;
        if (!a!.isDirectory && b!.isDirectory) return 1;
        // Then alphabetical
        return a!.name.localeCompare(b!.name);
      });

    return NextResponse.json({
      path: normalized,
      parentPath: path.dirname(normalized),
      items,
      totalItems: items.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read directory', details: String(error) },
      { status: 500 }
    );
  }
}
