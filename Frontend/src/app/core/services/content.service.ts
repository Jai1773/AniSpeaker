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
import { Observable, map, of, catchError, throwError, tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class ContentService {
  constructor(private readonly http: HttpClient) {}

  readonly fallbackItems: Content[] = [];
  private memoryCatalog: Content[] = [];
  private detailCache = new Map<string, { item: Content; episodes: Episode[]; raw?: ApiContentDetail }>();

  getCachedHome(): Content[] {
    if (this.memoryCatalog.length > 0) return this.memoryCatalog;
    try {
      const raw = localStorage.getItem('anispeaker.cached-home');
      if (raw) {
        this.memoryCatalog = JSON.parse(raw);
        return this.memoryCatalog;
      }
    } catch {}
    return [];
  }

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
            const mapped = result.items.map((item) => this.toContent(item));
            if (!type && !categoryId && page === 1) {
              this.memoryCatalog = mapped;
              try {
                localStorage.setItem('anispeaker.cached-home', JSON.stringify(mapped.slice(0, 50)));
              } catch {}
            }
            return mapped;
          }
          return this.fallbackItems.filter((x) => !type || (type === 'Movie' ? x.type === 'Movie' : x.type !== 'Movie'));
        }),
        catchError(() => {
          const cached = this.getCachedHome();
          if (cached.length > 0) {
            return of(cached.filter((x) => !type || (type === 'Movie' ? x.type === 'Movie' : x.type !== 'Movie')));
          }
          return of(
            this.fallbackItems.filter((x) => !type || (type === 'Movie' ? x.type === 'Movie' : x.type !== 'Movie'))
          );
        })
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
    const normalized = slug.trim().toLowerCase();
    const cached = this.detailCache.get(normalized);

    const net$ = this.http.get<ApiContentDetail>(`${API_BASE_URL}/api/content/${encodeURIComponent(slug)}`).pipe(
      map((result) => {
        const episodeList: Episode[] = [];

        if (result.seasons && result.seasons.length > 0) {
          for (const s of result.seasons) {
            const seasonNum = s.number || 1;
            if (s.episodes && s.episodes.length > 0) {
              for (const ep of s.episodes) {
                episodeList.push(this.toEpisode(ep, seasonNum));
              }
            }
          }
        }

        if (result.episodes && result.episodes.length > 0) {
          for (const ep of result.episodes) {
            if (!episodeList.some((x) => x.id === ep.id)) {
              episodeList.push(this.toEpisode(ep, 1));
            }
          }
        }

        episodeList.sort((a, b) => {
          const sA = a.seasonNumber || 1;
          const sB = b.seasonNumber || 1;
          if (sA !== sB) return sA - sB;
          return a.number - b.number;
        });

        const detailObj = {
          item: this.toContent(result),
          episodes: episodeList,
          raw: result,
        };
        this.detailCache.set(normalized, detailObj);
        return detailObj;
      }),
      catchError((error) => {
        if (cached) return of(cached);
        return throwError(() => error);
      })
    );

    return cached ? of(cached) : net$;
  }

  playback(episodeId: string): Observable<PlaybackDto> {
    return this.http.get<PlaybackDto>(`${API_BASE_URL}/api/playback/${episodeId}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  toContent(item: ApiContent): Content {
    let type: ContentType = 'Anime';
    if (item.type === 'Movie') {
      type = 'Movie';
    } else if (
      item.categoryId === '22341509-de1c-44b4-bf6a-ba657e8a6519' ||
      item.tags?.some((t) => t.toLowerCase() === 'cartoon')
    ) {
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

  toEpisode(episode: ApiEpisode, seasonNumber = 1): Episode {
    return {
      id: episode.id,
      contentId: episode.contentId,
      seasonId: episode.seasonId,
      seasonNumber,
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
