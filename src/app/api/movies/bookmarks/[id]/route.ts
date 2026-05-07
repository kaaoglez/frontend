import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookmark = await db.movieBookmark.findUnique({
      where: { id },
    });

    if (!bookmark) {
      return NextResponse.json({ error: 'Movie bookmark not found' }, { status: 404 });
    }

    return NextResponse.json({ bookmark });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch movie bookmark', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      tmdbId,
      title,
      originalTitle,
      overview,
      posterPath,
      backdropPath,
      releaseDate,
      voteAverage,
      genreIds,
      streamingUrl,
      notes,
      status,
    } = body;

    const bookmark = await db.movieBookmark.update({
      where: { id },
      data: {
        ...(tmdbId !== undefined && { tmdbId: tmdbId ? (tmdbId as number) : null }),
        ...(title !== undefined && { title }),
        ...(originalTitle !== undefined && { originalTitle: originalTitle || null }),
        ...(overview !== undefined && { overview: overview || null }),
        ...(posterPath !== undefined && { posterPath: posterPath || null }),
        ...(backdropPath !== undefined && { backdropPath: backdropPath || null }),
        ...(releaseDate !== undefined && { releaseDate: releaseDate || null }),
        ...(voteAverage !== undefined && { voteAverage: voteAverage ?? null }),
        ...(genreIds !== undefined && {
          genreIds: typeof genreIds === 'string' ? genreIds : JSON.stringify(genreIds || []),
        }),
        ...(streamingUrl !== undefined && { streamingUrl: streamingUrl || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json({ bookmark });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update movie bookmark', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.movieBookmark.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete movie bookmark', details: String(error) },
      { status: 500 }
    );
  }
}
