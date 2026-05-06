import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// GET /api/settings?key=musicLibraryPaths
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
  }

  try {
    const setting = await db.setting.findUnique({ where: { key } });

    if (!setting) {
      return NextResponse.json({ key, value: '' });
    }

    return NextResponse.json({ key: setting.key, value: setting.value });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST /api/settings  body: { key: string, value: string }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
    }

    await db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    return NextResponse.json({ key, value });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
