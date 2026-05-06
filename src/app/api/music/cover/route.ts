import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Cover image filenames to look for (in order of priority)
const COVER_NAMES = [
  'folder.jpg', 'Folder.jpg', 'FOLDER.JPG',
  'cover.jpg', 'Cover.jpg', 'COVER.JPG',
  'albumart.jpg', 'AlbumArt.jpg',
  'album.jpg', 'Album.jpg',
  'front.jpg', 'Front.jpg',
  'art.jpg', 'Art.jpg',
  'folder.png', 'cover.png', 'albumart.png',
  'folder.webp', 'cover.webp',
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dirPath = searchParams.get('path');

  if (!dirPath) {
    return NextResponse.json({ error: 'Path required' }, { status: 400 });
  }

  try {
    const normalized = path.normalize(dirPath);
    if (normalized.includes('..')) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
    }

    if (!fs.existsSync(normalized)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const stat = fs.statSync(normalized);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: 'Not a directory' }, { status: 400 });
    }

    // Look for cover image
    for (const coverName of COVER_NAMES) {
      const coverPath = path.join(normalized, coverName);
      if (fs.existsSync(coverPath)) {
        const coverStat = fs.statSync(coverPath);
        const coverBuffer = fs.readFileSync(coverPath);
        const ext = path.extname(coverName).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          '.png': 'image/png', '.webp': 'image/webp',
        };
        return new NextResponse(coverBuffer, {
          headers: {
            'Content-Type': mimeTypes[ext] || 'image/jpeg',
            'Content-Length': String(coverStat.size),
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }

    // No cover found - return placeholder JSON
    return NextResponse.json({ hasCover: false });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read cover', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const dirPath = formData.get('path') as string;
    const file = formData.get('cover') as File | null;

    if (!dirPath || !file) {
      return NextResponse.json({ error: 'Path and cover file required' }, { status: 400 });
    }

    const normalized = path.normalize(dirPath);
    if (normalized.includes('..')) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
    }

    if (!fs.existsSync(normalized)) {
      return NextResponse.json({ error: 'Directory not found' }, { status: 404 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine extension
    const ext = path.extname(file.name).toLowerCase() || '.jpg';
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ error: 'Only jpg, png, webp allowed' }, { status: 400 });
    }

    // Remove old cover images first
    for (const coverName of COVER_NAMES) {
      const oldCover = path.join(normalized, coverName);
      if (fs.existsSync(oldCover)) {
        fs.unlinkSync(oldCover);
      }
    }

    // Save as cover.jpg (standardized name)
    const coverPath = path.join(normalized, `cover${ext}`);
    fs.writeFileSync(coverPath, buffer);

    return NextResponse.json({ success: true, cover: `cover${ext}` });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to upload cover', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { path: dirPath } = await request.json();

  if (!dirPath) {
    return NextResponse.json({ error: 'Path required' }, { status: 400 });
  }

  try {
    const normalized = path.normalize(dirPath);
    if (normalized.includes('..')) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
    }

    let deleted = false;
    for (const coverName of COVER_NAMES) {
      const coverPath = path.join(normalized, coverName);
      if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath);
        deleted = true;
      }
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete cover', details: String(error) }, { status: 500 });
  }
}
