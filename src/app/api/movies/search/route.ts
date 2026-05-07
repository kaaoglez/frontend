import { NextRequest, NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  popularity: number;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query') || '';
  const page = request.nextUrl.searchParams.get('page') || '1';

  if (!TMDB_API_KEY) {
    return NextResponse.json(
      {
        error: 'TMDB_API_KEY no configurada',
        message: 'Para buscar películas necesitas una API key de TMDB. Regístrate gratis en themoviedb.org, obtén tu API key y agrégala al archivo .env como TMDB_API_KEY=tu_key_aquí',
        results: [],
        totalPages: 0,
        totalResults: 0,
      },
      { status: 200 }
    );
  }

  try {
    let url: string;

    if (query.trim()) {
      url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}&language=es-ES`;
    } else {
      url = `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&page=${page}&language=es-ES`;
    }

    const response = await fetch(url, { next: { revalidate: 300 } });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          {
            error: 'TMDB API Key inválida',
            message: 'La API key configurada no es válida. Verifica tu TMDB_API_KEY en el archivo .env',
            results: [],
            totalPages: 0,
            totalResults: 0,
          },
          { status: 200 }
        );
      }
      const errorData = await response.text();
      return NextResponse.json(
        { error: 'Error al buscar en TMDB', details: errorData, results: [], totalPages: 0, totalResults: 0 },
        { status: 200 }
      );
    }

    const data = await response.json();

    const results: (TmdbMovie & { poster_url: string | null; backdrop_url: string | null })[] =
      (data.results || []).map((movie: TmdbMovie) => ({
        ...movie,
        poster_url: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
        backdrop_url: movie.backdrop_path ? `${TMDB_IMAGE_BASE}${movie.backdrop_path}` : null,
      }));

    return NextResponse.json({
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error de conexión con TMDB', details: String(error), results: [], totalPages: 0, totalResults: 0 },
      { status: 200 }
    );
  }
}
