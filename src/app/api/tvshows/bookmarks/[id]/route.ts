import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookmark = await db.tvShowBookmark.findUnique({ where: { id } });
    if (!bookmark) {
      return NextResponse.json({ error: 'TV show bookmark not found' }, { status: 404 });
    }
    return NextResponse.json({ bookmark });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch TV show bookmark', details: String(error) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, posterPath, streamingUrl, notes, status, rating, seasons, currentSeason, currentEpisode, network, genre } = body;

    const bookmark = await db.tvShowBookmark.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(posterPath !== undefined && { posterPath: posterPath || null }),
        ...(streamingUrl !== undefined && { streamingUrl: streamingUrl || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(status !== undefined && { status }),
        ...(rating !== undefined && { rating: rating ?? null }),
        ...(seasons !== undefined && { seasons: seasons ?? null }),
        ...(currentSeason !== undefined && { currentSeason: currentSeason ?? null }),
        ...(currentEpisode !== undefined && { currentEpisode: currentEpisode ?? null }),
        ...(network !== undefined && { network: network || null }),
        ...(genre !== undefined && { genre: genre || null }),
      },
    });

    return NextResponse.json({ bookmark });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update TV show bookmark', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.tvShowBookmark.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete TV show bookmark', details: String(error) }, { status: 500 });
  }
}