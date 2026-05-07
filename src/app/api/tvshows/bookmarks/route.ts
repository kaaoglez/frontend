import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const bookmarks = await db.tvShowBookmark.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ bookmarks });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch TV show bookmarks', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, posterPath, streamingUrl, notes, status, rating, seasons, currentSeason, currentEpisode, network, genre } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const bookmark = await db.tvShowBookmark.create({
      data: {
        title: title.trim(),
        posterPath: posterPath || null,
        streamingUrl: streamingUrl || null,
        notes: notes || null,
        status: status || 'pendiente',
        rating: rating ?? null,
        seasons: seasons ?? null,
        currentSeason: currentSeason ?? null,
        currentEpisode: currentEpisode ?? null,
        network: network || null,
        genre: genre || null,
      },
    });

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create TV show bookmark', details: String(error) }, { status: 500 });
  }
}