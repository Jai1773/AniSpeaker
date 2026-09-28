import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { Content } from '../../models/content.model';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/services/content.service';
import { AccountService } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth.service';
import { LocalHistoryService } from '../../core/services/local-history.service';
import { forkJoin, of } from 'rxjs';
import {
  NavComponent,
  ContentCardComponent,
  FooterComponent,
} from '../../shared/components/layout.component';

export interface ContinueWatchingItem {
  id: string;
  slug: string;
  episodeId: string;
  seasonNumber?: number;
  episodeNumber?: number;
  title: string;
  subtitle: string;
  image: string;
  progressPercent: number;
}

@Component({
  selector: 'app-row',
  standalone: true,
  imports: [ContentCardComponent, RouterLink],
  inputs: ['title', 'items'],
  templateUrl: './content-row.component.html',
  styleUrl: './content-row.component.scss',
})
export class RowComponent {
  title = '';
  items: Content[] = [];
}

@Component({
  standalone: true,
  imports: [RouterLink, NavComponent, FooterComponent, RowComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private service = inject(ContentService);
  private account = inject(AccountService);
  readonly auth = inject(AuthService);
  private localHistory = inject(LocalHistoryService);
  private changeDetector = inject(ChangeDetectorRef);

  // Initialize immediately from client cache for 0ms initial render
  items: Content[] = this.service.getCachedHome();
  featured: Content = this.items[0];
  continued: ContinueWatchingItem[] = [];
  anime: Content[] = this.items.filter((item) => item.type === 'Anime');
  cartoons: Content[] = this.items.filter((item) => item.type === 'Cartoon');
  movies: Content[] = this.items.filter((item) => item.type === 'Movie');
  error = '';
  genres = [
    'Action',
    'Adventure',
    'Comedy',
    'Fantasy',
    'Sci-Fi',
    'Animation',
    'Family',
    'Mystery',
    'Drama',
  ];

  ngOnInit(): void {
    // 1. Prepare data fetches
    const catalog$ = this.service.browse();
    const history$ = this.auth.isLoggedIn
      ? this.account.history()
      : of(null);

    // 2. Parallel fetch to avoid waterfalls
    forkJoin({
      catalog: catalog$,
      history: history$,
    }).subscribe({
      next: ({ catalog, history }) => {
        this.setCatalog(catalog);

        if (history) {
          this.setContinueWatching(history);
        } else {
          this.loadGuestHistory();
        }

        this.changeDetector.detectChanges();
      },
      error: (err) => {
        console.error('Home data fetch failed', err);
        if (!this.featured) {
          this.error = 'Unable to load live content.';
        }

        // Fallback for history if the combined request failed
        if (!this.auth.isLoggedIn || !this.continued.length) {
          this.loadGuestHistory();
        }

        this.changeDetector.detectChanges();
      },
    });
  }

  private loadGuestHistory(): void {
    const guestHist = this.localHistory.list();
    this.continued = guestHist.slice(0, 4).map((g) => {
      const dur = g.durationSeconds || 1440;
      const pct = Math.min(100, Math.max(0, Math.round((g.progressSeconds / dur) * 100)));
      return {
        id: g.episodeId,
        slug: g.slug,
        episodeId: g.episodeId,
        seasonNumber: g.seasonNumber || 1,
        episodeNumber: g.episodeNumber || 1,
        title: g.title,
        subtitle: 'Resume',
        image: g.image,
        progressPercent: pct,
      };
    });
    this.changeDetector.detectChanges();
  }

  private setContinueWatching(hist: any[]): void {
    this.continued = (hist || []).slice(0, 4).map((h) => {
      const dur = h.episode?.durationSeconds || 1440;
      const pct = Math.min(100, Math.max(0, Math.round((h.progressSeconds / dur) * 100)));
      return {
        id: h.episode?.id || '',
        slug: h.content?.slug || '',
        episodeId: h.episode?.id || '',
        seasonNumber: h.episode?.seasonNumber || 1,
        episodeNumber: h.episode?.number || 1,
        title: h.content?.title || 'Title',
        subtitle: `Ep. ${h.episode?.number || 1}`,
        image: h.episode?.thumbnailUrl || h.content?.posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
        progressPercent: pct,
      };
    });
  }


  private setCatalog(items: Content[]): void {
    if (items && items.length > 0) {
      this.items = items;
      this.featured = items[0];
      this.movies = items.filter((item) => item.type === 'Movie');
      this.cartoons = items.filter((item) => item.type === 'Cartoon');
      this.anime = items.filter((item) => item.type === 'Anime');
    }
  }
}
