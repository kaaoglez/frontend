import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const stations = await db.radioStation.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ stations });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch radio stations', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, genre, country, description, faviconUrl, isFavorite } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: 'name and url are required' },
        { status: 400 }
      );
    }

    // Get the max order to place new station at the end
    const maxOrder = await db.radioStation.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const station = await db.radioStation.create({
      data: {
        name,
        url,
        genre: genre || null,
        country: country || null,
        description: description || null,
        faviconUrl: faviconUrl || null,
        isFavorite: isFavorite ?? false,
        order: (maxOrder?.order ?? -1) + 1,
      },
    });

    return NextResponse.json({ station }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create radio station', details: String(error) },
      { status: 500 }
    );
  }
}
