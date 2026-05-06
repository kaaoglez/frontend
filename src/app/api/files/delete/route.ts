import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath } = body;

    if (!filePath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    const normalized = path.normalize(filePath);
    if (normalized.includes('..')) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
    }

    if (!fs.existsSync(normalized)) {
      return NextResponse.json({ error: 'File or directory not found' }, { status: 404 });
    }

    const stat = fs.statSync(normalized);

    if (stat.isDirectory()) {
      fs.rmSync(normalized, { recursive: true, force: true });
    } else {
      fs.unlinkSync(normalized);
    }

    return NextResponse.json({ success: true, deleted: normalized });
  } catch (error) {
    return NextResponse.json(
      { error: 'Delete failed', details: String(error) },
      { status: 500 }
    );
  }
}
