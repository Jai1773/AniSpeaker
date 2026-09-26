import { Injectable } from '@angular/core';
import { Content } from '../../models/content.model';

@Injectable({ providedIn: 'root' })
export class LocalWatchLaterService {
  private readonly key = 'anispeaker.guest-watchlater';

  list(): Content[] {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  has(contentIdOrSlug: string): boolean {
    const items = this.list();
    return items.some((x) => x.id === contentIdOrSlug || x.slug === contentIdOrSlug);
  }

  add(item: Content): void {
    const items = this.list().filter((x) => x.id !== item.id && x.slug !== item.slug);
    localStorage.setItem(this.key, JSON.stringify([item, ...items].slice(0, 50)));
  }

  remove(contentIdOrSlug: string): void {
    const items = this.list().filter((x) => x.id !== contentIdOrSlug && x.slug !== contentIdOrSlug);
    localStorage.setItem(this.key, JSON.stringify(items));
  }

  clear(): void {
    localStorage.removeItem(this.key);
  }
}

