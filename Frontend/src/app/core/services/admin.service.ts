import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { ApiContent, PageResult } from '../../models/content.model';

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
  videoKey: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  published: boolean;
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

  createEpisode(seasonId: string, value: SaveEpisode): Observable<void> {
    return this.http.post<void>(`${API_BASE_URL}/api/admin/seasons/${seasonId}/episodes`, value);
  }

  updateEpisode(id: string, value: SaveEpisode): Observable<void> {
    return this.http.put<void>(`${API_BASE_URL}/api/admin/episodes/${id}`, value);
  }

  deleteEpisode(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/api/admin/episodes/${id}`);
  }

  initUpload(file: File, folder: 'videos' | 'images' | 'thumbnails'): Observable<UploadInit> {
    return this.http.post<UploadInit>(`${API_BASE_URL}/api/admin/uploads/init`, {
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      folder,
    });
  }
}
