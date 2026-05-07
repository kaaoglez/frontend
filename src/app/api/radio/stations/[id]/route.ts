import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const station = await db.radioStation.findUnique({
      where: { id },
    });

    if (!station) {
      return NextResponse.json({ error: 'Radio station not found' }, { status: 404 });
    }

    return NextResponse.json({ station });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch radio station', details: String(error) },
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
    const { name, url, genre, country, description, faviconUrl, isFavorite, order } = body;

    const station = await db.radioStation.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(url !== undefined && { url }),
        ...(genre !== undefined && { genre: genre || null }),
        ...(country !== undefined && { country: country || null }),
        ...(description !== undefined && { description: description || null }),
        ...(faviconUrl !== undefined && { faviconUrl: faviconUrl || null }),
        ...(isFavorite !== undefined && { isFavorite }),
        ...(order !== undefined && { order }),
      },
    });

    return NextResponse.json({ station });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update radio station', details: String(error) },
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
    await db.radioStation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete radio station', details: String(error) },
      { status: 500 }
    );
  }
}
