import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parentPath, name } = body;

    if (!parentPath || !name) {
      return NextResponse.json({ error: 'Parent path and name are required' }, { status: 400 });
    }

    const normalized = path.normalize(parentPath);
    if (normalized.includes('..')) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
    }

    const newPath = path.join(normalized, name);

    if (fs.existsSync(newPath)) {
      return NextResponse.json({ error: 'Already exists' }, { status: 409 });
    }

    fs.mkdirSync(newPath, { recursive: true });

    return NextResponse.json({ success: true, path: newPath });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create directory', details: String(error) },
      { status: 500 }
    );
  }
}
