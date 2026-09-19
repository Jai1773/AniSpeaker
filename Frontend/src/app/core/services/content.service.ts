import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Content,
  ContentType,
  Episode,
  ApiContent,
  ApiContentDetail,
  ApiContentType,
  ApiEpisode,
  PageResult,
  PlaybackDto,
} from '../../models/content.model';
import { Observable, map, of, catchError } from 'rxjs';
import { API_BASE_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class ContentService {
  constructor(private readonly http: HttpClient) {}

  readonly fallbackItems: Content[] = [
    {
      id: 'mock-1',
      slug: 'solar-guardians',
      title: 'Solar Guardians',
      type: 'Anime',
      year: 2026,
      rating: 9.2,
      duration: '24m',
      genre: 'Adventure, Sci-Fi',
      image:
        'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
      backdrop:
        'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1800&q=85',
      description:
        'When a dying star sends a final signal, four unlikely heroes race through the outer worlds to keep their home alive.',
    },
    {
      id: 'mock-2',
      slug: 'wildwood-chronicles',
      title: 'Wildwood Chronicles',
      type: 'Cartoon',
      year: 2026,
      rating: 8.7,
      duration: '22m',
      genre: 'Family, Fantasy',
      image:
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=600&q=80',
      backdrop:
        'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1800&q=80',
      description:
        'A curious explorer and her tiny dragon discover a secret world hidden just beyond the forest.',
    },
    {
      id: 'mock-3',
      slug: 'neon-horizon',
      title: 'Neon Horizon',
      type: 'Movie',
      year: 2025,
      rating: 8.9,
      duration: '1h 54m',
      genre: 'Sci-Fi, Action',
      image:
        'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=600&q=80',
      backdrop:
        'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1800&q=85',
      description:
        'At the edge of a luminous city, one pilot learns the future is closer than it appears.',
    },
    {
      id: 'mock-4',
      slug: 'dragon-academy',
      title: 'Dragon Academy',
      type: 'Cartoon',
      year: 2026,
      rating: 8.5,
      duration: '26m',
      genre: 'Fantasy, Kids',
      image:
        'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=600&q=80',
      backdrop:
        'https://images.unsplash.com/photo-1464802686167-b939a6910659?auto=format&fit=crop&w=1800&q=80',
      description: 'New students, ancient creatures and a school in the clouds.',
    },
    {
      id: 'mock-5',
      slug: 'echoes-of-tokyo',
      title: 'Echoes of Tokyo',
      type: 'Anime',
      year: 2025,
      rating: 9.0,
      duration: '24m',
      genre: 'Drama, Supernatural',
      image:
        'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80',
      backdrop:
        'https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1800&q=80',
      description: 'Some promises are loud. The ones that matter echo quietly.',
    },
    {
      id: 'mock-6',
      slug: 'deep-blue',
      title: 'Deep Blue',
      type: 'Movie',
      year: 2026,
      rating: 8.3,
      duration: '1h 48m',
      genre: 'Mystery, Adventure',
      image:
        'https://images.unsplash.com/photo-1518467166778-b88f373ffec7?auto=format&fit=crop&w=600&q=80',
      backdrop:
        'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1800&q=80',
      description: 'A dive below the surface reveals a world no map has ever named.',
    },
  ];

  get(slug: string | null): Content {
    return this.fallbackItems.find((x) => x.slug === slug) || this.fallbackItems[0];
  }

  browse(type?: ApiContentType, categoryId?: string, page = 1, pageSize = 50): Observable<Content[]> {
    let params = new HttpParams().set('page', page.toString()).set('pageSize', pageSize.toString());
    if (type) params = params.set('type', type);
    if (categoryId) params = params.set('category', categoryId);

    return this.http
      .get<PageResult<ApiContent>>(`${API_BASE_URL}/api/content`, { params })
      .pipe(
        map((result) => {
          if (result && result.items && result.items.length > 0) {
            return result.items.map((item) => this.toContent(item));
          }
          return this.fallbackItems.filter((x) => !type || (type === 'Movie' ? x.type === 'Movie' : x.type !== 'Movie'));
        }),
        catchError(() =>
          of(
            this.fallbackItems.filter((x) => !type || (type === 'Movie' ? x.type === 'Movie' : x.type !== 'Movie'))
          )
        )
      );
  }

  search(query: string): Observable<Content[]> {
    if (!query.trim()) return of([]);
    return this.http
      .get<ApiContent[]>(`${API_BASE_URL}/api/search`, {
        params: new HttpParams().set('q', query.trim()),
      })
      .pipe(
        map((items) => items.map((item) => this.toContent(item))),
        catchError(() =>
          of(
            this.fallbackItems.filter(
              (x) =>
                x.title.toLowerCase().includes(query.toLowerCase()) ||
                x.genre?.toLowerCase().includes(query.toLowerCase()) ||
                x.description.toLowerCase().includes(query.toLowerCase())
            )
          )
        )
      );
  }

  detail(slug: string): Observable<{ item: Content; episodes: Episode[]; raw?: ApiContentDetail }> {
    return this.http.get<ApiContentDetail>(`${API_BASE_URL}/api/content/${encodeURIComponent(slug)}`).pipe(
      map((result) => {
        const rawEpisodes: ApiEpisode[] = [
          ...(result.episodes || []),
          ...(result.seasons || []).flatMap((s) => s.episodes || []),
        ].sort((a, b) => a.number - b.number);

        return {
          item: this.toContent(result),
          episodes: rawEpisodes.map((ep) => this.toEpisode(ep)),
          raw: result,
        };
      }),
      catchError(() => {
        const fallback = this.fallbackItems.find((x) => x.slug === slug) || this.fallbackItems[0];
        const mockEpisodes: Episode[] = Array.from({ length: 6 }, (_, i) => ({
          id: `mock-ep-${i + 1}`,
          contentId: String(fallback.id),
          number: i + 1,
          title: `Episode ${i + 1}`,
          duration: '24m',
          durationSeconds: 1440,
          description: fallback.description,
          image: fallback.backdrop,
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        }));
        return of({
          item: fallback,
          episodes: mockEpisodes,
        });
      })
    );
  }

  playback(episodeId: string): Observable<PlaybackDto> {
    return this.http.get<PlaybackDto>(`${API_BASE_URL}/api/playback/${episodeId}`).pipe(
      catchError(() =>
        of({
          episodeId,
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        })
      )
    );
  }

  toContent(item: ApiContent): Content {
    let type: ContentType = 'Anime';
    if (item.type === 'Movie') {
      type = 'Movie';
    } else if (item.tags?.some((t) => t.toLowerCase() === 'cartoon')) {
      type = 'Cartoon';
    }

    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      type,
      year: 2026,
      rating: 8.8,
      duration: item.type === 'Movie' ? '1h 50m' : 'Series',
      genre: item.tags?.join(', ') || item.type,
      image: item.posterUrl || item.bannerUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
      backdrop: item.bannerUrl || item.posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1800&q=85',
      description: item.description || 'No description available.',
      categoryId: item.categoryId,
    };
  }

  toEpisode(episode: ApiEpisode): Episode {
    return {
      id: episode.id,
      contentId: episode.contentId,
      seasonId: episode.seasonId,
      number: episode.number,
      title: episode.title || `Episode ${episode.number}`,
      duration: this.formatDuration(episode.durationSeconds),
      durationSeconds: episode.durationSeconds || 1440,
      description: `Episode ${episode.number}`,
      image: episode.thumbnailUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
    };
  }

  private formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '24m';
    const m = Math.floor(seconds / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m`;
  }
}
