import { Component, inject, OnInit } from '@angular/core';
import { Content } from '../../models/content.model';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/services/content.service';
import { AccountService } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth.service';
import { LocalHistoryService } from '../../core/services/local-history.service';
import {
  NavComponent,
  ContentCardComponent,
  FooterComponent,
} from '../../shared/components/layout.component';

export interface ContinueWatchingItem {
  id: string;
  slug: string;
  episodeId: string;
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
  private auth = inject(AuthService);
  private localHistory = inject(LocalHistoryService);

  items: Content[] = [];
  featured: Content = this.service.fallbackItems[0];
  continued: ContinueWatchingItem[] = [];
  anime: Content[] = [];
  cartoons: Content[] = [];
  movies: Content[] = [];
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
    // 1. Load catalog from API
    this.service.browse().subscribe({
      next: (items) => {
        this.items = items;
        if (items.length > 0) {
          this.featured = items[0];
          this.anime = items.filter((item) => item.type === 'Anime');
          this.cartoons = items.filter((item) => item.type === 'Cartoon');
          this.movies = items.filter((item) => item.type === 'Movie');
        }
      },
      error: () => (this.error = 'Unable to load content. Make sure the API is running.'),
    });

    // 2. Load Continue Watching (Guest local vs Logged-in synced)
    if (this.auth.isLoggedIn) {
      this.account.history().subscribe({
        next: (hist) => {
          this.continued = hist.slice(0, 4).map((h) => {
            const dur = h.episode?.durationSeconds || 1440;
            const pct = Math.min(100, Math.max(0, Math.round((h.progressSeconds / dur) * 100)));
            return {
              id: h.episode?.id || '',
              slug: h.content?.slug || '',
              episodeId: h.episode?.id || '',
              title: h.content?.title || 'Title',
              subtitle: `Ep. ${h.episode?.number || 1}`,
              image: h.episode?.thumbnailUrl || h.content?.posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
              progressPercent: pct,
            };
          });
        },
      });
    } else {
      const guestHist = this.localHistory.list();
      this.continued = guestHist.slice(0, 4).map((g) => {
        const dur = g.durationSeconds || 1440;
        const pct = Math.min(100, Math.max(0, Math.round((g.progressSeconds / dur) * 100)));
        return {
          id: g.episodeId,
          slug: g.slug,
          episodeId: g.episodeId,
          title: g.title,
          subtitle: 'Resume',
          image: g.image,
          progressPercent: pct,
        };
      });
    }
  }
}
