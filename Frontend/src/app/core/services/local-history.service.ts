import { Injectable } from '@angular/core';

export interface LocalHistory {
  slug: string;
  episodeId: string;
  seasonNumber?: number;
  episodeNumber?: number;
  title: string;
  image: string;
  progressSeconds: number;
  durationSeconds: number;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class LocalHistoryService {
  private readonly key = 'anispeaker.guest-history';

  list(): LocalHistory[] {
    try {
      return JSON.parse(localStorage.getItem(this.key) ?? '[]');
    } catch {
      return [];
    }
  }

  save(item: LocalHistory): void {
    const items = this.list().filter((x) => x.episodeId !== item.episodeId);
    localStorage.setItem(this.key, JSON.stringify([item, ...items].slice(0, 10)));
  }

  clear(): void {
    localStorage.removeItem(this.key);
  }
}
