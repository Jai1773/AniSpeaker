import { ChangeDetectorRef, Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { of, map } from 'rxjs';
import { Content, Episode, ApiContentType, VideoSourceDto } from '../../models/content.model';
import { ContentService } from '../../core/services/content.service';
import { AccountService } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth.service';
import { LocalHistoryService } from '../../core/services/local-history.service';
import { LocalWatchLaterService } from '../../core/services/local-watch-later.service';
import {
  NavComponent,
  ContentCardComponent,
  FooterComponent,
} from '../../shared/components/layout.component';

const shell = [NavComponent, ContentCardComponent, FooterComponent, RouterLink];

export interface HistoryViewItem {
  episodeId: string;
  slug: string;
  seasonNumber?: number;
  episodeNumber?: number;
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
  private changeDetector = inject(ChangeDetectorRef);

  type: string | null = null;
  list: Content[] = this.svc.getCachedHome();
  loading = false;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.type = params.get('type');
      let apiType: ApiContentType | undefined;
      if (this.type === 'movie' || this.type === 'movies') {
        apiType = 'Movie';
      } else if (this.type === 'anime' || this.type === 'cartoon' || this.type === 'cartoons') {
        apiType = 'Series';
      }

      this.list = this.filterItems(this.svc.getCachedHome(), this.type);
      this.svc.browse(apiType).subscribe({
        next: (items) => {
          this.list = this.filterItems(items, this.type);
          this.changeDetector.detectChanges();
        },
        error: () => this.changeDetector.detectChanges(),
      });
    });
  }

  private filterItems(items: Content[], type: string | null): Content[] {
    if (type === 'movies' || type === 'movie') return items.filter((item) => item.type === 'Movie');
    if (type === 'anime') return items.filter((item) => item.type === 'Anime');
    if (type === 'cartoon' || type === 'cartoons') return items.filter((item) => item.type === 'Cartoon');
    return items;
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
  private changeDetector = inject(ChangeDetectorRef);
  private account = inject(AccountService);
  private auth = inject(AuthService);
  private localWatchLater = inject(LocalWatchLaterService);
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
      const normalizedSlug = decodeURIComponent(slug);

      this.svc.detail(normalizedSlug).subscribe({
        next: (result) => {
          this.item = result.item;
          this.episodes = result.episodes;

          try {
            localStorage.setItem('anispeaker_active_slug', result.item.slug);
          } catch {}

          this.changeDetector.detectChanges();

          // Load related titles
          this.svc.browse().subscribe({
            next: (items) => {
              this.related = items
                .filter((x) => x.id !== result.item.id && x.slug !== result.item.slug)
                .slice(0, 6);
              this.changeDetector.detectChanges();
            },
          });

          // Check if saved in Watch Later (check both account and local storage)
          const inLocal = this.localWatchLater.has(this.item.id) || this.localWatchLater.has(this.item.slug);
          if (this.auth.isLoggedIn) {
            this.account.watchLater().subscribe({
              next: (saved) => {
                this.isSaved = (saved || []).some((s) => s.id === this.item.id || s.slug === this.item.slug) || inLocal;
                this.changeDetector.detectChanges();
              },
              error: () => {
                this.isSaved = inLocal;
                this.changeDetector.detectChanges();
              },
            });
          } else {
            this.isSaved = inLocal;
            this.changeDetector.detectChanges();
          }
        },
        error: () => {
          this.feedback = 'This title could not be loaded. Please try again.';
          this.changeDetector.detectChanges();
        },
      });
    });
  }

  toggleWatchLater(): void {
    if (this.isSaved) {
      if (this.auth.isLoggedIn) {
        this.account.removeWatchLater(String(this.item.id)).subscribe();
      }
      this.localWatchLater.remove(this.item.id);
      this.localWatchLater.remove(this.item.slug);
      this.isSaved = false;
      this.feedback = 'Removed from Watch Later.';
      this.changeDetector.detectChanges();
      setTimeout(() => {
        this.feedback = '';
        this.changeDetector.detectChanges();
      }, 3000);
    } else {
      if (this.auth.isLoggedIn) {
        this.account.addWatchLater(String(this.item.id)).subscribe();
      }
      this.localWatchLater.add(this.item);
      this.isSaved = true;
      this.feedback = 'Saved to Watch Later!';
      this.changeDetector.detectChanges();
      setTimeout(() => {
        this.feedback = '';
        this.changeDetector.detectChanges();
      }, 3000);
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
  private changeDetector = inject(ChangeDetectorRef);

  item?: Content;
  episodes: Episode[] = [];
  currentEpisode?: Episode;

  videoUrl = '';
  safeVideoUrl: SafeResourceUrl | null = null;
  isEmbedPlayer = false;

  availableSources: VideoSourceDto[] = [];
  selectedSourceIndex = 0;

  loading = true;
  error = '';
  private lastSavedSeconds = 0;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      // Support clean URLs:
      // /watch/:slug/:seasonSegment/:epSegment
      // /watch/:slug/:epSegment
      // /watch/:slug
      // /watch/:seasonSegment/:epSegment
      // /watch/:id
      const seasonSegment = params.get('seasonSegment');
      const epSegment = params.get('epSegment');
      let slug = params.get('slug') || params.get('id');

      if (!slug) {
        slug = this.route.snapshot.queryParamMap.get('slug') ||
               localStorage.getItem('anispeaker_active_slug') ||
               '';
      }

      this.loading = true;
      this.error = '';

      const resolveSlug$ = slug
        ? of(slug)
        : this.svc.browse().pipe(
            map((items) => (items && items.length > 0 ? items[0].slug : ''))
          );

      resolveSlug$.subscribe({
        next: (targetSlug) => {
          if (!targetSlug) {
            this.loading = false;
            this.error = 'No titles found in catalog.';
            this.changeDetector.detectChanges();
            return;
          }

          const normalizedSlug = decodeURIComponent(targetSlug);
          try {
            localStorage.setItem('anispeaker_active_slug', normalizedSlug);
          } catch {}

          this.svc.detail(normalizedSlug).subscribe({
            next: (detail) => {
              this.item = detail.item;
              this.episodes = detail.episodes;
              this.changeDetector.detectChanges();

              // Parse season number and episode number from URL segments
              let targetSeasonNum: number | null = null;
              let targetEpNum: number | null = null;

              if (seasonSegment) {
                const sMatch = seasonSegment.match(/\d+/);
                if (sMatch) targetSeasonNum = parseInt(sMatch[0], 10);
              }
              if (epSegment) {
                const epMatch = epSegment.match(/\d+/);
                if (epMatch) targetEpNum = parseInt(epMatch[0], 10);
              }

              let target: Episode | undefined;

              if (targetEpNum !== null) {
                target = this.episodes.find((e) => {
                  const matchNum = e.number === targetEpNum;
                  if (targetSeasonNum !== null) {
                    return matchNum && (e.seasonNumber || 1) === targetSeasonNum;
                  }
                  return matchNum;
                });
              }

              if (!target) {
                const epId = this.route.snapshot.queryParamMap.get('episode');
                if (epId) {
                  target = this.episodes.find((e) => e.id === epId || String(e.number) === epId);
                }
              }

              if (!target) {
                target = this.episodes[0];
              }

              if (target) {
                // Ensure address bar URL matches /watch/:slug/season-:season/ep-:ep format
                const sNum = target.seasonNumber || 1;
                const epNum = target.number;
                this.router.navigate(['/watch', this.item.slug, `season-${sNum}`, `ep-${epNum}`], { replaceUrl: true });
                this.selectEpisode(target, false);
              } else {
                this.loading = false;
                this.error = 'No playable episodes found for this title.';
                this.changeDetector.detectChanges();
              }
            },
            error: () => {
              this.loading = false;
              this.error = 'Failed to load title information.';
              this.changeDetector.detectChanges();
            },
          });
        },
        error: () => {
          this.loading = false;
          this.error = 'Failed to load title information.';
          this.changeDetector.detectChanges();
        },
      });
    });
  }

  selectEpisode(episode: Episode, updateUrl = true): void {
    this.currentEpisode = episode;
    this.loading = true;
    this.error = '';

    if (updateUrl && this.item) {
      try {
        localStorage.setItem('anispeaker_active_slug', this.item.slug);
      } catch {}

      const sNum = episode.seasonNumber || 1;
      const epNum = episode.number;
      // Always navigate to /watch/:slug/season-:season/ep-:ep
      this.router.navigate(['/watch', this.item.slug, `season-${sNum}`, `ep-${epNum}`]);
    }

    // Call backend playback endpoint for ordered list of active video sources
    this.svc.playback(episode.id).subscribe({
      next: (playback) => {
        this.loading = false;
        const sources = playback.sources && playback.sources.length > 0
          ? playback.sources
          : playback.videoUrl || episode.videoUrl
            ? [{ id: 'default', playerName: 'Default Player', url: playback.videoUrl || episode.videoUrl || '', embedType: 'Direct' as const, quality: null, sortOrder: 0 }]
            : [];

        this.availableSources = sources;
        this.selectedSourceIndex = 0;

        if (this.availableSources.length === 0) {
          this.error = 'Video stream is not available for this episode yet.';
          setTimeout(() => this.changeDetector.detectChanges());
          return;
        }

        this.loadSelectedSource();
        setTimeout(() => this.changeDetector.detectChanges());
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load video player. Please try again later.';
        setTimeout(() => this.changeDetector.detectChanges());
      },
    });
  }

  loadSelectedSource(): void {
    const src = this.availableSources[this.selectedSourceIndex];
    const rawUrl = src?.url || '';

    if (!rawUrl) {
      this.error = 'Selected video stream is unavailable.';
      return;
    }

    this.videoUrl = rawUrl;
    this.isEmbedPlayer = src.embedType !== 'Direct';

    if (this.isEmbedPlayer) {
      this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
    }

    // Record initial watch event
    this.saveProgress(1);
  }

  switchSource(index: number): void {
    if (index >= 0 && index < this.availableSources.length) {
      this.selectedSourceIndex = index;
      this.error = '';
      this.loadSelectedSource();
    }
  }

  onVideoError(): void {
    if (this.selectedSourceIndex + 1 < this.availableSources.length) {
      this.selectedSourceIndex++;
      this.loadSelectedSource();
    } else {
      this.error = 'Video playback error. All available servers could not be loaded.';
    }
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
        seasonNumber: this.currentEpisode.seasonNumber || 1,
        episodeNumber: this.currentEpisode.number || 1,
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
  private localWatchLater = inject(LocalWatchLaterService);
  private changeDetector = inject(ChangeDetectorRef);

  items: Content[] = [];
  loading = true;

  ngOnInit(): void {
    const guestItems = this.localWatchLater.list();

    if (!this.auth.isLoggedIn) {
      this.items = guestItems;
      this.loading = false;
      this.changeDetector.detectChanges();
      return;
    }

    this.account.watchLater().subscribe({
      next: (apiItems) => {
        const remote = (apiItems || []).map((x) => this.svc.toContent(x));
        const merged = [...remote];
        for (const g of guestItems) {
          if (!merged.some((x) => x.id === g.id || x.slug === g.slug)) {
            merged.push(g);
          }
        }
        this.items = merged;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.items = guestItems;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  remove(contentId: string): void {
    if (this.auth.isLoggedIn) {
      this.account.removeWatchLater(contentId).subscribe();
    }
    this.localWatchLater.remove(contentId);
    this.items = this.items.filter((x) => x.id !== contentId);
    this.changeDetector.detectChanges();
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
  private changeDetector = inject(ChangeDetectorRef);

  items: HistoryViewItem[] = [];
  loading = true;

  ngOnInit(): void {
    if (this.auth.isLoggedIn) {
      this.account.history().subscribe({
        next: (historyList) => {
          this.items = (historyList || []).map((h) => {
            const total = h.episode?.durationSeconds || 1440;
            const pct = Math.min(100, Math.max(0, Math.round((h.progressSeconds / total) * 100)));
            return {
              episodeId: h.episode?.id || '',
              slug: h.content?.slug || '',
              seasonNumber: h.episode?.seasonNumber || 1,
              episodeNumber: h.episode?.number || 1,
              title: h.content?.title || 'AniSpeaker Content',
              subtitle: `Episode ${h.episode?.number || 1}: ${h.episode?.title || ''}`,
              image: h.episode?.thumbnailUrl || h.content?.posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
              progressPercent: pct,
            };
          });
          this.loading = false;
          this.changeDetector.detectChanges();
        },
        error: () => {
          this.items = [];
          this.loading = false;
          this.changeDetector.detectChanges();
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
          seasonNumber: g.seasonNumber || 1,
          episodeNumber: g.episodeNumber || 1,
          title: g.title,
          subtitle: 'Watched on this browser',
          image: g.image,
          progressPercent: pct,
        };
      });
      this.loading = false;
      this.changeDetector.detectChanges();
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
  private route = inject(ActivatedRoute);

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
      next: () => {
        this.loading = false;
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        if (returnUrl && (returnUrl !== '/admin' || this.auth.isAdmin)) {
          this.router.navigateByUrl(returnUrl);
        } else if (this.auth.isAdmin) {
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
