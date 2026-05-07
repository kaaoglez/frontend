import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

    const bookmark = await db.bookBookmark.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(author !== undefined && { author: author?.trim() || null }),
        ...(description !== undefined && { description: description || null }),
        ...(coverUrl !== undefined && { coverUrl: coverUrl || null }),
        ...(externalUrl !== undefined && { externalUrl: externalUrl || null }),
        ...(isbn !== undefined && { isbn: isbn?.trim() || null }),
        ...(format !== undefined && { format: format || 'Físico' }),
        ...(status !== undefined && { status: status || 'No leído' }),
        ...(rating !== undefined && { rating: rating ?? null }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    });

    return NextResponse.json({ bookmark });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update book bookmark', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await db.bookBookmark.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete book bookmark', details: String(error) },
      { status: 500 }
    );
  }
}
