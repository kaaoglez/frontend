import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath, newName } = body;

    if (!filePath || !newName) {
      return NextResponse.json({ error: 'filePath and newName are required' }, { status: 400 });
    }

    const normalized = path.normalize(filePath);
    if (normalized.includes('..')) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
    }

    if (!fs.existsSync(normalized)) {
      return NextResponse.json({ error: 'File or directory not found' }, { status: 404 });
    }

    // Sanitize new name - prevent path traversal
    if (newName.includes('/') || newName.includes('\\') || newName.includes('..') || newName.includes('\0')) {
      return NextResponse.json({ error: 'Invalid new name' }, { status: 400 });
    }

    const parentDir = path.dirname(normalized);
    const oldName = path.basename(normalized);
    const oldExt = path.extname(oldName);

    // If it's a file (not a directory) and the new name doesn't have the same extension, auto-append it
    const isDirectory = fs.statSync(normalized).isDirectory();
    let finalName = newName.trim();
    if (!isDirectory && oldExt) {
      const newExt = path.extname(finalName);
      // Only auto-append if user didn't type an extension at all
      if (!newExt) {
        finalName = finalName + oldExt;
      }
      // If user typed a different extension, still keep the old one (safer)
      if (newExt && newExt.toLowerCase() !== oldExt.toLowerCase()) {
        finalName = path.basename(finalName, newExt) + oldExt;
      }
    }

    const newPath = path.join(parentDir, finalName);

    // Check if target already exists
    if (fs.existsSync(newPath) && newPath !== normalized) {
      return NextResponse.json({ error: 'A file with that name already exists' }, { status: 409 });
    }

    // Safety: verify the file/dir exists right before renaming
    if (!fs.existsSync(normalized)) {
      return NextResponse.json({ error: 'File or directory not found' }, { status: 404 });
    }

    fs.renameSync(normalized, newPath);

    // Safety: verify the rename actually worked
    if (!fs.existsSync(newPath)) {
      return NextResponse.json({ error: 'Rename failed - file disappeared after rename' }, { status: 500 });
    }

    return NextResponse.json({ success: true, oldPath: normalized, newPath, newName: finalName });
  } catch (error) {
    return NextResponse.json(
      { error: 'Rename failed', details: String(error) },
      { status: 500 }
    );
  }
}
