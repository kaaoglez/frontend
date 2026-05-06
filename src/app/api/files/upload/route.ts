import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const targetPath = formData.get('path') as string || '/home/z';

    const normalized = path.normalize(targetPath);
    if (normalized.includes('..')) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
    }

    if (!fs.existsSync(normalized)) {
      fs.mkdirSync(normalized, { recursive: true });
    }

    const uploaded: Array<{ name: string; size: number; path: string }> = [];

    for (const file of files) {
      const filePath = path.join(normalized, file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      uploaded.push({
        name: file.name,
        size: file.size,
        path: filePath,
      });
    }

    return NextResponse.json({
      success: true,
      uploaded,
      count: uploaded.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Upload failed', details: String(error) },
      { status: 500 }
    );
  }
}
