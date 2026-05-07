import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status');
  const search = request.nextUrl.searchParams.get('search');

  try {
    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { author: { contains: search } },
      ];
    }

    const bookmarks = await db.bookBookmark.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ bookmarks });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch book bookmarks', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      author,
      description,
      coverUrl,
      externalUrl,
      isbn,
      format,
      status,
      rating,
      notes,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    const bookmark = await db.bookBookmark.create({
      data: {
        title: title.trim(),
        author: author?.trim() || null,
        description: description || null,
        coverUrl: coverUrl || null,
        externalUrl: externalUrl || null,
        isbn: isbn?.trim() || null,
        format: format || 'Físico',
        status: status || 'No leído',
        rating: rating ?? null,
        notes: notes || null,
      },
    });

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create book bookmark', details: String(error) },
      { status: 500 }
    );
  }
}
