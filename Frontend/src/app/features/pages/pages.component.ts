import { Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Content, Episode, ApiContentType } from '../../models/content.model';
import { ContentService } from '../../core/services/content.service';
import { AccountService } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth.service';
import { LocalHistoryService } from '../../core/services/local-history.service';
import {
  NavComponent,
  ContentCardComponent,
  FooterComponent,
} from '../../shared/components/layout.component';

const shell = [NavComponent, ContentCardComponent, FooterComponent, RouterLink];

export interface HistoryViewItem {
  episodeId: string;
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  progressPercent: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. BrowseComponent
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  standalone: true,
  imports: [NavComponent, ContentCardComponent, FooterComponent, RouterLink],
  templateUrl: './browse.component.html',
  styleUrl: './pages.component.scss',
})
export class BrowseComponent implements OnInit {
  private svc = inject(ContentService);
  private route = inject(ActivatedRoute);

  type: string | null = null;
  list: Content[] = [];
  loading = true;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.type = params.get('type');
      let apiType: ApiContentType | undefined;
      if (this.type === 'movie' || this.type === 'movies') {
        apiType = 'Movie';
      } else if (this.type === 'anime' || this.type === 'cartoon' || this.type === 'cartoons') {
        apiType = 'Series';
      }

      this.loading = true;
      this.svc.browse(apiType).subscribe({
        next: (items) => {
          if (this.type === 'cartoon' || this.type === 'cartoons') {
            this.list = items.filter((x) => x.type === 'Cartoon');
          } else if (this.type === 'anime') {
            this.list = items.filter((x) => x.type === 'Anime');
          } else {
            this.list = items;
          }
          this.loading = false;
        },
        error: () => {
          this.list = [];
          this.loading = false;
        },
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SearchComponent
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  standalone: true,
  imports: [NavComponent, ContentCardComponent, FooterComponent, FormsModule],
  templateUrl: './search.component.html',
  styleUrl: './pages.component.scss',
})
export class SearchComponent {
  private svc = inject(ContentService);
  query = '';
  filtered: Content[] = [];

  search(): void {
    const q = this.query.trim();
    if (!q) {
      this.filtered = [];
      return;
    }
    this.svc.search(q).subscribe({
      next: (items) => (this.filtered = items),
      error: () => (this.filtered = []),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DetailComponent
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  standalone: true,
  imports: shell,
  templateUrl: './detail.component.html',
  styleUrl: './pages.component.scss',
})
export class DetailComponent implements OnInit {
  private svc = inject(ContentService);
  private account = inject(AccountService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  item: Content = this.svc.get(null);
  episodes: Episode[] = [];
  related: Content[] = [];
  isSaved = false;
  feedback = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (!slug) return;

      this.svc.detail(slug).subscribe({
        next: (result) => {
          this.item = result.item;
          this.episodes = result.episodes;

          // Load related titles
          this.svc.browse().subscribe({
            next: (items) =>
              (this.related = items
                .filter((x) => x.id !== result.item.id && x.slug !== result.item.slug)
                .slice(0, 6)),
          });

          // Check if saved in Watch Later
          if (this.auth.isLoggedIn) {
            this.account.watchLater().subscribe({
              next: (saved) => {
                this.isSaved = saved.some((s) => s.id === this.item.id || s.slug === this.item.slug);
              },
            });
          }
        },
      });
    });
  }

  toggleWatchLater(): void {
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.isSaved) {
      this.account.removeWatchLater(String(this.item.id)).subscribe({
        next: () => {
          this.isSaved = false;
          this.feedback = 'Removed from Watch Later.';
          setTimeout(() => (this.feedback = ''), 3000);
        },
      });
    } else {
      this.account.addWatchLater(String(this.item.id)).subscribe({
        next: () => {
          this.isSaved = true;
          this.feedback = 'Saved to Watch Later!';
          setTimeout(() => (this.feedback = ''), 3000);
        },
        error: () => {
          this.feedback = 'Could not save to Watch Later.';
        },
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PlayerComponent (Outsourced player + direct stream support)
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  standalone: true,
  imports: [NavComponent, FooterComponent, RouterLink],
  templateUrl: './player.component.html',
  styleUrl: './pages.component.scss',
})
export class PlayerComponent implements OnInit {
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;

  private svc = inject(ContentService);
  private account = inject(AccountService);
  private auth = inject(AuthService);
  private localHistory = inject(LocalHistoryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  item?: Content;
  episodes: Episode[] = [];
  currentEpisode?: Episode;

  videoUrl = '';
  safeVideoUrl: SafeResourceUrl | null = null;
  isEmbedPlayer = false;

  loading = true;
  error = '';
  private lastSavedSeconds = 0;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('id'); // route is /watch/:id
      if (!slug) return;

      this.loading = true;
      this.error = '';

      this.svc.detail(slug).subscribe({
        next: (detail) => {
          this.item = detail.item;
          this.episodes = detail.episodes;

          // Determine active episode from query param or first episode
          this.route.queryParamMap.subscribe((queryParams) => {
            const epId = queryParams.get('episode');
            const target =
              this.episodes.find((e) => e.id === epId || String(e.number) === epId) ||
              this.episodes[0];

            if (target) {
              this.selectEpisode(target, false);
            } else {
              this.loading = false;
              this.error = 'No playable episodes found for this title.';
            }
          });
        },
        error: () => {
          this.loading = false;
          this.error = 'Failed to load title information.';
        },
      });
    });
  }

  selectEpisode(episode: Episode, updateUrl = true): void {
    this.currentEpisode = episode;
    this.loading = true;
    this.error = '';

    if (updateUrl && this.item) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { episode: episode.id },
        queryParamsHandling: 'merge',
      });
    }

    // Call backend playback endpoint for outsourced player or direct video stream URL
    this.svc.playback(episode.id).subscribe({
      next: (playback) => {
        this.loading = false;
        const rawUrl = playback.videoUrl || episode.videoUrl || '';

        if (!rawUrl) {
          this.error = 'Video stream is not available for this episode yet.';
          return;
        }

        this.videoUrl = rawUrl;
        // Detect if URL is an outsourced embed player (e.g. YouTube, Vimeo, iframe embed link)
        this.isEmbedPlayer =
          rawUrl.includes('/embed/') ||
          rawUrl.includes('player.') ||
          rawUrl.includes('iframe') ||
          rawUrl.includes('vidsrc') ||
          (!rawUrl.endsWith('.mp4') && !rawUrl.endsWith('.webm') && !rawUrl.endsWith('.m3u8') && rawUrl.startsWith('http'));

        if (this.isEmbedPlayer) {
          this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
        }

        // Record initial watch event
        this.saveProgress(1);
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load video player. Please try again later.';
      },
    });
  }

  onMetadataLoaded(): void {
    // Resume playback if guest has saved history
    if (this.item && this.currentEpisode && !this.auth.isLoggedIn) {
      const guestHistory = this.localHistory.list().find((x) => x.episodeId === this.currentEpisode?.id);
      if (guestHistory && guestHistory.progressSeconds > 10 && this.videoElement?.nativeElement) {
        this.videoElement.nativeElement.currentTime = guestHistory.progressSeconds;
      }
    }
  }

  onTimeUpdate(): void {
    const v = this.videoElement?.nativeElement;
    if (!v || !this.currentEpisode || !this.item) return;

    const currentSec = Math.floor(v.currentTime);
    if (Math.abs(currentSec - this.lastSavedSeconds) >= 5) {
      this.lastSavedSeconds = currentSec;
      this.saveProgress(currentSec, Math.floor(v.duration || 0));
    }
  }

  private saveProgress(progressSeconds: number, durationSeconds?: number): void {
    if (!this.item || !this.currentEpisode) return;

    const dur = durationSeconds || this.currentEpisode.durationSeconds || 1440;

    if (this.auth.isLoggedIn) {
      this.account.saveHistory(this.currentEpisode.id, progressSeconds).subscribe();
    } else {
      this.localHistory.save({
        slug: this.item.slug,
        episodeId: this.currentEpisode.id,
        title: `${this.item.title} — Ep. ${this.currentEpisode.number}`,
        image: this.currentEpisode.image || this.item.backdrop,
        progressSeconds,
        durationSeconds: dur,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. WatchLaterComponent
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  standalone: true,
  imports: [NavComponent, ContentCardComponent, FooterComponent, RouterLink],
  templateUrl: './watch-later.component.html',
  styleUrl: './pages.component.scss',
})
export class WatchLaterComponent implements OnInit {
  auth = inject(AuthService);
  private account = inject(AccountService);
  private svc = inject(ContentService);

  items: Content[] = [];
  loading = true;

  ngOnInit(): void {
    if (!this.auth.isLoggedIn) {
      this.loading = false;
      return;
    }

    this.account.watchLater().subscribe({
      next: (apiItems) => {
        this.items = apiItems.map((x) => this.svc.toContent(x));
        this.loading = false;
      },
      error: () => {
        this.items = [];
        this.loading = false;
      },
    });
  }

  remove(contentId: string): void {
    this.account.removeWatchLater(contentId).subscribe({
      next: () => {
        this.items = this.items.filter((x) => x.id !== contentId);
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. HistoryComponent (Unified guest & account history)
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  standalone: true,
  imports: [NavComponent, FooterComponent, RouterLink],
  templateUrl: './history.component.html',
  styleUrl: './pages.component.scss',
})
export class HistoryComponent implements OnInit {
  auth = inject(AuthService);
  private account = inject(AccountService);
  private localHistory = inject(LocalHistoryService);

  items: HistoryViewItem[] = [];
  loading = true;

  ngOnInit(): void {
    if (this.auth.isLoggedIn) {
      this.account.history().subscribe({
        next: (historyList) => {
          this.items = historyList.map((h) => {
            const total = h.episode?.durationSeconds || 1440;
            const pct = Math.min(100, Math.max(0, Math.round((h.progressSeconds / total) * 100)));
            return {
              episodeId: h.episode?.id || '',
              slug: h.content?.slug || '',
              title: h.content?.title || 'AniSpeaker Content',
              subtitle: `Episode ${h.episode?.number || 1}: ${h.episode?.title || ''}`,
              image: h.episode?.thumbnailUrl || h.content?.posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
              progressPercent: pct,
            };
          });
          this.loading = false;
        },
        error: () => {
          this.items = [];
          this.loading = false;
        },
      });
    } else {
      const guestItems = this.localHistory.list();
      this.items = guestItems.map((g) => {
        const total = g.durationSeconds || 1440;
        const pct = Math.min(100, Math.max(0, Math.round((g.progressSeconds / total) * 100)));
        return {
          episodeId: g.episodeId,
          slug: g.slug,
          title: g.title,
          subtitle: 'Watched on this browser',
          image: g.image,
          progressPercent: pct,
        };
      });
      this.loading = false;
    }
  }

  clear(): void {
    if (!this.auth.isLoggedIn) {
      this.localHistory.clear();
      this.items = [];
    } else {
      this.items = [];
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. LoginComponent
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './pages.component.scss',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  error = '';
  loading = false;

  submit(): void {
    if (!this.email || !this.password) {
      this.error = 'Please enter both email and password.';
      return;
    }

    this.error = '';
    this.loading = true;

    this.auth.login(this.email.trim(), this.password).subscribe({
      next: (session) => {
        this.loading = false;
        if (session.role === 'Admin') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Invalid email or password. Please try again.';
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. RegisterComponent
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './register.component.html',
  styleUrl: './pages.component.scss',
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  name = '';
  email = '';
  password = '';
  error = '';
  loading = false;

  submit(): void {
    if (!this.name.trim() || !this.email.trim() || this.password.length < 8) {
      this.error = 'Please provide a name, valid email, and at least 8 characters for password.';
      return;
    }

    this.error = '';
    this.loading = true;

    this.auth.register(this.name.trim(), this.email.trim(), this.password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading = false;
        const msg = err.error?.errors?.[0]?.description || err.error?.title || 'Registration failed. Please check your information.';
        this.error = msg;
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. ProfileComponent
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  standalone: true,
  imports: [NavComponent, FooterComponent, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './pages.component.scss',
})
export class ProfileComponent {
  auth = inject(AuthService);
  private router = inject(Router);

  initials(): string {
    const name = this.auth.session?.displayName || '';
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
