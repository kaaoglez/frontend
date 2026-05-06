import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search') || '';
  const categoryId = request.nextUrl.searchParams.get('categoryId') || '';
  const status = request.nextUrl.searchParams.get('status') || '';
  const sortBy = request.nextUrl.searchParams.get('sortBy') || 'createdAt';
  const sortOrder = request.nextUrl.searchParams.get('sortOrder') || 'desc';
  const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { author: { contains: search } },
      { searchText: { contains: search.toLowerCase() } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status;

  const orderBy: Record<string, string> = { [sortBy]: sortOrder };

  try {
    const [books, total] = await Promise.all([
      db.book.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { id: true, name: true, color: true } },
          tags: { include: { tag: { select: { id: true, name: true } } } },
        },
      }),
      db.book.count({ where }),
    ]);

    return NextResponse.json({
      books,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch books', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, author, description, isbn, publisher, yearPublished, pages, language, format, coverUrl, location, status, rating, notes, categoryId, tagNames } = body;

    const book = await db.book.create({
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

    // Handle tags
    if (tagNames && tagNames.length > 0) {
      for (const tagName of tagNames) {
        const tag = await db.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        });
        await db.bookTag.create({
          data: { bookId: book.id, tagId: tag.id },
        });
      }
    }

    return NextResponse.json({ book }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create book', details: String(error) }, { status: 500 });
  }
}
