import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { ApiContent, ApiEpisode, PageResult, VideoEmbedType } from '../../models/content.model';

export interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface SaveContent {
  categoryId: string;
  title: string;
  slug: string;
  type: 'Series' | 'Movie';
  description: string | null;
  posterUrl: string | null;
  bannerUrl: string | null;
  tags: string[];
  published: boolean;
}

export interface SaveEpisode {
  number: number;
  title: string;
  videoKey?: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  published: boolean;
}

export interface BulkEpisodeItem {
  url: string;
  title?: string | null;
}

export interface BulkEpisodeRequest {
  thumbnailUrl: string;
  items?: BulkEpisodeItem[];
  urls?: string[];
  playerName?: string;
  embedType?: VideoEmbedType;
}

export interface SaveVideoSource {
  playerName: string;
  url: string;
  embedType: VideoEmbedType;
  quality?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminVideoSource {
  id: string;
  episodeId: string;
  playerName: string;
  url: string;
  embedType: VideoEmbedType;
  quality?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface UploadInit {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
}

export interface Season {
  id: string;
  number: number;
  title: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}

  categories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${API_BASE_URL}/api/admin/categories`);
  }

  createCategory(value: Omit<Category, 'id'>): Observable<Category> {
    return this.http.post<Category>(`${API_BASE_URL}/api/admin/categories`, value);
  }

  updateCategory(id: string, value: Omit<Category, 'id'>): Observable<void> {
    return this.http.put<void>(`${API_BASE_URL}/api/admin/categories/${id}`, value);
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/api/admin/categories/${id}`);
  }

  content(search?: string, category?: string, type?: string, page = 1, pageSize = 100): Observable<PageResult<ApiContent>> {
    let params = new HttpParams().set('page', page.toString()).set('pageSize', pageSize.toString());
    if (search) params = params.set('search', search);
    if (category) params = params.set('category', category);
    if (type) params = params.set('type', type);

    return this.http.get<PageResult<ApiContent>>(`${API_BASE_URL}/api/admin/content`, { params });
  }

  createContent(value: SaveContent): Observable<ApiContent> {
    return this.http.post<ApiContent>(`${API_BASE_URL}/api/admin/content`, value);
  }

  updateContent(id: string, value: SaveContent): Observable<void> {
    return this.http.put<void>(`${API_BASE_URL}/api/admin/content/${id}`, value);
  }

  deleteContent(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/api/admin/content/${id}`);
  }

  createSeason(contentId: string, value: { number: number; title: string }): Observable<Season> {
    return this.http.post<Season>(`${API_BASE_URL}/api/admin/content/${contentId}/seasons`, value);
  }

  createEpisode(seasonId: string, value: SaveEpisode): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${API_BASE_URL}/api/admin/seasons/${seasonId}/episodes`, value);
  }

  bulkCreateEpisodes(seasonId: string, payload: BulkEpisodeRequest): Observable<ApiEpisode[]>;
  bulkCreateEpisodes(seasonId: string, urls: string[], playerName?: string, embedType?: VideoEmbedType): Observable<ApiEpisode[]>;
  bulkCreateEpisodes(
    seasonId: string,
    payloadOrUrls: BulkEpisodeRequest | string[],
    playerName = 'Vidmoly',
    embedType: VideoEmbedType = 'Iframe',
  ): Observable<ApiEpisode[]> {
    const payload = Array.isArray(payloadOrUrls)
      ? { urls: payloadOrUrls, playerName, embedType }
      : payloadOrUrls;
    return this.http.post<ApiEpisode[]>(`${API_BASE_URL}/api/admin/seasons/${seasonId}/episodes/bulk-urls`, payload);
  }

  createEpisodeForMovie(contentId: string, value: SaveEpisode): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${API_BASE_URL}/api/admin/content/${contentId}/episodes`, value);
  }

  updateEpisode(id: string, value: SaveEpisode): Observable<void> {
    return this.http.put<void>(`${API_BASE_URL}/api/admin/episodes/${id}`, value);
  }

  deleteEpisode(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/api/admin/episodes/${id}`);
  }

  getEpisodeSources(episodeId: string): Observable<AdminVideoSource[]> {
    return this.http.get<AdminVideoSource[]>(`${API_BASE_URL}/api/admin/episodes/${episodeId}/sources`);
  }

  createSource(episodeId: string, value: SaveVideoSource): Observable<AdminVideoSource> {
    return this.http.post<AdminVideoSource>(`${API_BASE_URL}/api/admin/episodes/${episodeId}/sources`, value);
  }

  updateSource(id: string, value: SaveVideoSource): Observable<void> {
    return this.http.put<void>(`${API_BASE_URL}/api/admin/sources/${id}`, value);
  }

  deleteSource(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/api/admin/sources/${id}`);
  }

  reorderSources(episodeId: string, orderedSourceIds: string[]): Observable<void> {
    return this.http.put<void>(`${API_BASE_URL}/api/admin/episodes/${episodeId}/sources/reorder`, {
      orderedSourceIds,
    });
  }

}
