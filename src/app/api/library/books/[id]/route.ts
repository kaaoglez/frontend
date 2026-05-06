import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const book = await db.book.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, color: true } },
        tags: { include: { tag: { select: { id: true, name: true } } } },
      },
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    return NextResponse.json({ book });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch book', details: String(error) }, { status: 500 });
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
      title, author, description, isbn, publisher,
      yearPublished, pages, language, format, coverUrl,
      location, status, rating, notes, categoryId, tagNames,
    } = body;

    // Update book
    await db.book.update({
      where: { id },
      data: {
        title,
        author,
        description: description || null,
        isbn: isbn || null,
        publisher: publisher || null,
        yearPublished: yearPublished || null,
        pages: pages || null,
        language: language || 'Español',
        format: format || 'Físico',
        coverUrl: coverUrl || null,
        location: location || null,
        status: status || 'No leído',
        rating: rating || null,
        notes: notes || null,
        categoryId: categoryId || null,
        searchText: `${title} ${author} ${description || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
      },
    });

    // Update tags
    if (tagNames && Array.isArray(tagNames)) {
      // Delete existing tags
      await db.bookTag.deleteMany({ where: { bookId: id } });
      // Create new tags
      for (const tagName of tagNames) {
        if (tagName.trim()) {
          const tag = await db.tag.upsert({
            where: { name: tagName.trim() },
            update: {},
            create: { name: tagName.trim() },
          });
          await db.bookTag.create({
            data: { bookId: id, tagId: tag.id },
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update book', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.book.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete book', details: String(error) }, { status: 500 });
  }
}
