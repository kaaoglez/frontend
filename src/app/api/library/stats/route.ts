import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [totalBooks, booksRead, totalPages, uniqueAuthors, booksByStatus, booksByFormat, categories, recentBooks] = await Promise.all([
      db.book.count(),
      db.book.count({ where: { status: 'Leído' } }),
      db.book.aggregate({ _sum: { pages: true } }),
      db.book.groupBy({ by: ['author'], select: { author: true } }),
      db.book.groupBy({ by: ['status'], _count: { status: true } }),
      db.book.groupBy({ by: ['format'], _count: { format: true } }),
      db.category.findMany({ include: { _count: { select: { books: true } } } }),
      db.book.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { category: { select: { id: true, name: true, color: true } } } }),
    ]);

    return NextResponse.json({
      totalBooks,
      booksRead,
      totalPages: totalPages._sum.pages || 0,
      uniqueAuthors: uniqueAuthors.length,
      booksByStatus,
      booksByFormat,
      categories,
      recentBooks,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get stats', details: String(error) }, { status: 500 });
  }
}
