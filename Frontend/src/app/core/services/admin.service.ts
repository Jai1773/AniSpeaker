import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { ApiContent, PageResult } from '../../models/content.model';
export interface Category { id: string; name: string; slug: string; sortOrder: number; }
export interface SaveContent { categoryId: string; title: string; slug: string; type: 'Series' | 'Movie'; description: string | null; posterUrl: string | null; bannerUrl: string | null; tags: string[]; published: boolean; }
export interface UploadInit { uploadUrl: string; publicUrl: string; objectKey: string; }
export interface Season { id: string; number: number; title: string; }
@Injectable({ providedIn: 'root' }) export class AdminService {
  constructor(private http: HttpClient) {}
  categories(): Observable<Category[]> { return this.http.get<Category[]>(`${API_BASE_URL}/api/admin/categories`); }
  createCategory(value: Omit<Category, 'id'>): Observable<Category> { return this.http.post<Category>(`${API_BASE_URL}/api/admin/categories`, value); }
  deleteCategory(id: string): Observable<void> { return this.http.delete<void>(`${API_BASE_URL}/api/admin/categories/${id}`); }
  content(): Observable<PageResult<ApiContent>> { return this.http.get<PageResult<ApiContent>>(`${API_BASE_URL}/api/admin/content?pageSize=100`); }
  createContent(value: SaveContent): Observable<ApiContent> { return this.http.post<ApiContent>(`${API_BASE_URL}/api/admin/content`, value); }
  updateContent(id: string, value: SaveContent): Observable<void> { return this.http.put<void>(`${API_BASE_URL}/api/admin/content/${id}`, value); }
  deleteContent(id: string): Observable<void> { return this.http.delete<void>(`${API_BASE_URL}/api/admin/content/${id}`); }
  createSeason(contentId: string, value: { number: number; title: string }): Observable<Season> { return this.http.post<Season>(`${API_BASE_URL}/api/admin/content/${contentId}/seasons`, value); }
  createEpisode(seasonId: string, value: { number: number; title: string; videoKey: string; thumbnailUrl: string | null; durationSeconds: number; published: boolean }): Observable<void> { return this.http.post<void>(`${API_BASE_URL}/api/admin/seasons/${seasonId}/episodes`, value); }
  initUpload(file: File, folder: string): Observable<UploadInit> { return this.http.post<UploadInit>(`${API_BASE_URL}/api/admin/uploads/init`, { fileName: file.name, contentType: file.type, folder }); }
}
