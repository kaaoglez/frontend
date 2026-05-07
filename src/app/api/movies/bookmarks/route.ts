import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status');

  try {
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const bookmarks = await db.movieBookmark.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ bookmarks });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch movie bookmarks', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'El título es obligatorio' },
        { status: 400 }
      );
    }

    if (tmdbId) {
      const existing = await db.movieBookmark.findFirst({
        where: { tmdbId: tmdbId as number },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Esta película ya está guardada', bookmark: existing },
          { status: 409 }
        );
      }
    }

    const bookmark = await db.movieBookmark.create({
      data: {
        tmdbId: tmdbId ? (tmdbId as number) : null,
        title: title.trim(),
        originalTitle: originalTitle?.trim() || null,
        overview: overview || null,
        posterPath: posterPath || null,
        backdropPath: backdropPath || null,
        releaseDate: releaseDate || null,
        voteAverage: voteAverage ?? null,
        genreIds: typeof genreIds === 'string' ? genreIds : JSON.stringify(genreIds || []),
        streamingUrl: streamingUrl?.trim() || null,
        notes: notes?.trim() || null,
        status: status || 'pendiente',
      },
    });

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    console.error('Error creating movie bookmark:', error);
    return NextResponse.json(
      { error: 'Error al guardar la película', details: String(error) },
      { status: 500 }
    );
  }
}
