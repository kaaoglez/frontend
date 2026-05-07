import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const bookmarks = await db.musicBookmark.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ bookmarks });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch music bookmarks', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, artist, album, coverUrl, externalUrl, notes, isFavorite } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    const bookmark = await db.musicBookmark.create({
      data: {
        title,
        artist: artist || null,
        album: album || null,
        coverUrl: coverUrl || null,
        externalUrl: externalUrl || null,
        notes: notes || null,
        isFavorite: isFavorite ?? false,
      },
    });

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create music bookmark', details: String(error) },
      { status: 500 }
    );
  }
}
