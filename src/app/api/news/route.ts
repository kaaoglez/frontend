import { NextResponse } from 'next/server';

// ── In-memory cache ─────────────────────────────────────────────────────────

let cachedNews: Array<{ title: string; source: string; url: string; snippet: string; time: string }> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ── RSS Feed parsing helper ─────────────────────────────────────────────────

async function fetchRSSFeed(feedUrl: string, sourceName: string, maxItems: number = 5): Promise<Array<{ title: string; source: string; url: string; snippet: string; time: string }>> {
  try {
    const res = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ServerDashboard/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const text = await res.text();
    const items: Array<{ title: string; source: string; url: string; snippet: string; time: string }> = [];

    // Simple regex-based RSS parser (no XML parser needed)
    const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/gi) || [];

    for (let i = 0; i < Math.min(itemMatches.length, maxItems); i++) {
      const item = itemMatches[i];

      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
      const linkMatch = item.match(/<link>(.*?)<\/link>/i);
      const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/i);
      const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/i);

      if (titleMatch) {
        const title = (titleMatch[1] || titleMatch[2] || '').trim();
        const url = (linkMatch?.[1] || '').trim();
        let snippet = (descMatch?.[1] || descMatch?.[2] || '').trim();
        // Strip HTML tags from snippet
        snippet = snippet.replace(/<[^>]*>/g, '').substring(0, 200);
        const time = pubDateMatch?.[1] ? new Date(pubDateMatch[1]).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

        if (title) {
          items.push({ title, source: sourceName, url, snippet, time });
        }
      }
    }

    return items;
  } catch {
    return [];
  }
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Return cached data if still fresh
    if (cachedNews && Date.now() - cacheTimestamp < CACHE_TTL) {
      return NextResponse.json({ news: cachedNews });
    }

    // Fetch from multiple RSS sources in parallel
    const [techNews, worldNews, mexicoNews] = await Promise.all([
      // Tech news
      fetchRSSFeed('https://feeds.bbci.co.uk/mundo/technology/rss.xml', 'BBC Tecnología', 4),
      // World news
      fetchRSSFeed('https://feeds.bbci.co.uk/mundo/internacional/rss.xml', 'BBC Internacional', 4),
      // Mexico/LatAm news
      fetchRSSFeed('https://feeds.bbci.co.uk/mundo/america_latina/rss.xml', 'BBC América Latina', 4),
    ]);

    const allNews = [...techNews, ...worldNews, ...mexicoNews]
      // Remove duplicates by title similarity
      .filter((item, idx, arr) => arr.findIndex((a) => a.title === item.title) === idx)
      .slice(0, 12);

    cachedNews = allNews;
    cacheTimestamp = Date.now();

    return NextResponse.json({ news: allNews });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch news', details: String(error) },
      { status: 500 },
    );
  }
}
