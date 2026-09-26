import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { ApiContent, ApiEpisode } from '../../models/content.model';

export interface HistoryItem {
  episode: ApiEpisode;
  content: ApiContent;
  progressSeconds: number;
  lastWatchedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  constructor(private readonly http: HttpClient) {}

  watchLater(): Observable<ApiContent[]> {
    return this.http.get<ApiContent[]>(`${API_BASE_URL}/api/account/watch-later`);
  }

  addWatchLater(contentId: string): Observable<void> {
    return this.http.post<void>(`${API_BASE_URL}/api/account/watch-later`, { contentId });
  }

  removeWatchLater(contentId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/api/account/watch-later/${contentId}`);
  }

  history(): Observable<HistoryItem[]> {
    return this.http.get<HistoryItem[]>(`${API_BASE_URL}/api/account/history`);
  }

  saveHistory(episodeId: string, progressSeconds: number): Observable<void> {
    return this.http.post<void>(`${API_BASE_URL}/api/account/history`, { episodeId, progressSeconds });
  }
}
