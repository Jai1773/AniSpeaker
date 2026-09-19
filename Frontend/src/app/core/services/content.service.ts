import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Content, ContentType, Episode, ApiContent, ApiContentDetail, ApiContentType, PageResult } from '../../models/content.model';
import { Observable, map } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class ContentService {
  constructor(private readonly http: HttpClient) {}
  readonly items: Content[] = [
    {
      id: 1,
      slug: 'solar-guardians',
      title: 'Solar Guardians',
      type: 'Anime',
      year: 2026,
      rating: 9.2,
      duration: '2h 08m',
      genre: 'Adventure',
      image:
        'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
      backdrop:
        'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1800&q=85',
      description:
        'When a dying star sends a final signal, four unlikely heroes race through the outer worlds to keep their home alive.',
    },
    {
      id: 2,
      slug: 'wildwood-chronicles',
      title: 'Wildwood Chronicles',
      type: 'Cartoon',
      year: 2026,
      rating: 8.7,
      duration: '24m',
      genre: 'Family',
      image:
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=600&q=80',
      backdrop:
        'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1800&q=80',
      description:
        'A curious explorer and her tiny dragon discover a secret world hidden just beyond the forest.',
    },
    {
      id: 3,
      slug: 'neon-horizon',
      title: 'Neon Horizon',
      type: 'Movie',
      year: 2025,
      rating: 8.9,
      duration: '1h 54m',
      genre: 'Sci-Fi',
      image:
        'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=600&q=80',
      backdrop:
        'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1800&q=85',
      description:
        'At the edge of a luminous city, one pilot learns the future is closer than it appears.',
    },
    {
      id: 4,
      slug: 'dragon-academy',
      title: 'Dragon Academy',
      type: 'Cartoon',
      year: 2026,
      rating: 8.5,
      duration: '28m',
      genre: 'Fantasy',
      image:
        'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=600&q=80',
      backdrop:
        'https://images.unsplash.com/photo-1464802686167-b939a6910659?auto=format&fit=crop&w=1800&q=80',
      description: 'New students, ancient creatures and a school in the clouds.',
    },
    {
      id: 5,
      slug: 'echoes-of-tokyo',
      title: 'Echoes of Tokyo',
      type: 'Anime',
      year: 2025,
      rating: 9.0,
      duration: '22m',
      genre: 'Drama',
      image:
        'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80',
      backdrop:
        'https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1800&q=80',
      description: 'Some promises are loud. The ones that matter echo quietly.',
    },
    {
      id: 6,
      slug: 'deep-blue',
      title: 'Deep Blue',
      type: 'Movie',
      year: 2026,
      rating: 8.3,
      duration: '1h 48m',
      genre: 'Mystery',
      image:
        'https://images.unsplash.com/photo-1518467166778-b88f373ffec7?auto=format&fit=crop&w=600&q=80',
      backdrop:
        'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1800&q=80',
      description: 'A dive below the surface reveals a world no map has ever named.',
    },
  ];
  episodes: Episode[] = Array.from({ length: 6 }, (_, i) => ({
    number: i + 1,
    title: [
      'The Last Signal',
      'A Map of Stars',
      'Into the Wild',
      'The Glass Sea',
      'After the Storm',
      'The Final Gate',
    ][i],
    duration: '24m',
    description: 'The journey takes an unexpected turn as new secrets surface.',
    image: `https://images.unsplash.com/photo-${['1518709268805-4e9042af9f23', '1534791547702-8e83a9e3b2a0', '1444703686981-a3abbc4d4fe3', '1497250681960-ef046c08a56e', '1462331940025-496dfbfc7564', '1534447677768-be436bb09401'][i]}?auto=format&fit=crop&w=600&q=80`,
    progress: i === 1 ? 68 : undefined,
  }));
  get(slug: string | null) {
    return this.items.find((x) => x.slug === slug) || this.items[0];
  }

  browse(type?: ApiContentType): Observable<Content[]> {
    let params = new HttpParams().set('page', '1').set('pageSize', '100');
    if (type) params = params.set('type', type);
    return this.http
      .get<PageResult<ApiContent>>('/api/content', { params })
      .pipe(map((result) => result.items.map((item) => this.toContent(item))));
  }

  search(query: string): Observable<Content[]> {
    return this.http
      .get<ApiContent[]>('/api/search', { params: new HttpParams().set('q', query) })
      .pipe(map((items) => items.map((item) => this.toContent(item))));
  }

  detail(slug: string): Observable<{ item: Content; episodes: Episode[] }> {
    return this.http.get<ApiContentDetail>(`/api/content/${encodeURIComponent(slug)}`).pipe(
      map((result) => ({
        item: this.toContent(result),
        episodes: [...result.episodes, ...result.seasons.flatMap((season) => season.episodes)]
          .map((episode) => this.toEpisode(episode)),
      })),
    );
  }

  private toContent(item: ApiContent): Content {
    const type: ContentType = item.type === 'Movie' ? 'Movie' : 'Anime';
    return {
      id: item.id, slug: item.slug, title: item.title, type, year: 0, rating: 0,
      duration: '', genre: item.tags.join(', ') || item.type,
      image: item.posterUrl || item.bannerUrl || 'https://placehold.co/600x900/171b29/ffffff?text=AniSpeaker',
      backdrop: item.bannerUrl || item.posterUrl || 'https://placehold.co/1800x900/171b29/ffffff?text=AniSpeaker',
      description: item.description || 'No description available yet.',
    };
  }

  private toEpisode(episode: ApiContentDetail['episodes'][number]): Episode {
    return {
      number: episode.number, title: episode.title,
      duration: this.formatDuration(episode.durationSeconds), description: '',
      image: episode.thumbnailUrl || 'https://placehold.co/600x340/171b29/ffffff?text=Episode',
    };
  }

  private formatDuration(seconds: number): string {
    return `${Math.floor(seconds / 60)}m`;
  }
}
