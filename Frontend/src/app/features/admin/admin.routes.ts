import { Routes, Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import {
  AdminService,
  Category,
  SaveContent,
  SaveEpisode,
  SaveVideoSource,
  AdminVideoSource,
  Season,
} from '../../core/services/admin.service';
import { ApiContent, ApiContentDetail, ApiSeason } from '../../models/content.model';
import { ContentService } from '../../core/services/content.service';
import { AuthService } from '../../core/services/auth.service';
import { forkJoin } from 'rxjs';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, UpperCasePipe],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  private api = inject(AdminService);
  private contentService = inject(ContentService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly auth = inject(AuthService);

  activeTab: 'dashboard' | 'categories' | 'content' | 'episodes' = 'dashboard';

  // Data collections
  categories: Category[] = [];
  contentList: ApiContent[] = [];
  seasons: Season[] = [];

  // Feedback & status
  loading = false;
  error = '';
  notice = '';

  // ─── Categories Form ────────────────────────────────────────────────────────
  catForm = {
    name: '',
    slug: '',
    sortOrder: 0,
  };

  // ─── Content Form ───────────────────────────────────────────────────────────
  editingContentId: string | null = null;
  contentForm: SaveContent = {
    categoryId: '',
    title: '',
    slug: '',
    type: 'Series',
    description: '',
    posterUrl: '',
    bannerUrl: '',
    tags: [],
    published: true,
  };
  contentTagsInput = '';

  // ─── Seasons & Episodes ─────────────────────────────────────────────────────
  selectedContentForEpisodes: ApiContent | null = null;
  contentDetailForEpisodes: ApiContentDetail | null = null;
  seasonForm = {
    number: 1,
    title: 'Season 1',
  };
  selectedSeasonId = '';
  activeSeasonId = '';
  activeSeasonTabId: string = 'all';
  episodeForm: SaveEpisode = {
    number: 1,
    title: '',
    thumbnailUrl: '',
    durationSeconds: 1440,
    published: true,
  };
  initialSource = {
    playerName: 'Vidmoly',
    url: '',
    embedType: 'Iframe' as const,
    quality: '1080p',
  };

  // ─── Video Sources Management ───────────────────────────────────────────────
  selectedEpisodeForSources: { id: string; title: string; number: number } | null = null;
  episodeSources: AdminVideoSource[] = [];
  newSourceForm: SaveVideoSource = {
    playerName: 'Vidmoly',
    url: '',
    embedType: 'Iframe',
    quality: '1080p',
    sortOrder: 0,
    isActive: true,
  };

  // ─── Bulk URL import ───────────────────────────────────────────────────────
  bulkUrls = '';
  bulkThumbnailUrl = '';
  bulkPlayerName = 'Vidmoly';
  bulkEmbedType: 'Iframe' | 'Direct' = 'Iframe';

  ngOnInit(): void {
    if (!this.auth.isLoggedIn) {
      this.error = 'You are not signed in. Please sign in with an Admin account to use this panel.';
      return;
    }
    if (!this.auth.isAdmin) {
      this.error =
        `Signed in as "${this.auth.session?.displayName || this.auth.session?.email}" ` +
        `but your role is "${this.auth.session?.role}". Admin role is required.`;
      return;
    }

    // Restore active tab from URL query parameters
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab && ['dashboard', 'categories', 'content', 'episodes'].includes(tab)) {
      this.activeTab = tab as any;
    }

    this.loadAll();
  }

  setTab(tab: 'dashboard' | 'categories' | 'content' | 'episodes'): void {
    this.activeTab = tab;
    this.updateUrl();
  }

  logoutAndRedirect(): void {
    this.auth.logout();
  }

  getSeriesCount(): number {
    return this.contentList.filter((c) => c.type === 'Series').length;
  }

  getMovieCount(): number {
    return this.contentList.filter((c) => c.type === 'Movie').length;
  }

  loadAll(): void {
    this.loading = true;
    this.error = '';

    forkJoin({ categories: this.api.categories(), content: this.api.content() }).subscribe({
      next: ({ categories, content }) => {
        this.categories = categories;
        this.contentList = content.items;
        if (!this.contentForm.categoryId && categories.length > 0) {
          this.contentForm.categoryId = categories[0].id;
        }
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.error = this.apiError(err, 'Failed to load dashboard data. Click Retry to try again.');
        this.changeDetector.detectChanges();
      },
    });
  }

  // ─── Categories ─────────────────────────────────────────────────────────────
  createCategory(): void {
    if (!this.catForm.name.trim()) {
      this.error = 'Category name is required.';
      return;
    }
    const slug =
      this.catForm.slug.trim() ||
      this.catForm.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    this.api.createCategory({ name: this.catForm.name.trim(), slug, sortOrder: Number(this.catForm.sortOrder) || 0 }).subscribe({
      next: () => {
        this.notice = 'Category added successfully!';
        this.catForm = { name: '', slug: '', sortOrder: 0 };
        this.loadAll();
        this.updateUrl();
        setTimeout(() => (this.notice = ''), 3000);
      },
      error: (err) => (this.error = this.apiError(err, 'Failed to add category.')),
    });
  }

  private updateUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: this.activeTab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  deleteCategory(id: string): void {
    if (!confirm('Are you sure you want to delete this category?')) return;
    this.api.deleteCategory(id).subscribe({
      next: () => {
        this.notice = 'Category deleted.';
        this.loadAll();
        setTimeout(() => (this.notice = ''), 3000);
      },
      error: () => (this.error = 'Could not delete category (may contain content).'),
    });
  }

  // ─── Content ────────────────────────────────────────────────────────────────
  onTitleChange(): void {
    if (!this.editingContentId && !this.contentForm.slug) {
      this.contentForm.slug = this.contentForm.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
  }

  saveContent(): void {
    if (!this.contentForm.title.trim()) {
      this.error = 'Title is required.';
      return;
    }

    this.contentForm.slug =
      this.contentForm.slug.trim() ||
      this.contentForm.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const payload: SaveContent = {
      ...this.contentForm,
      categoryId: this.contentForm.categoryId,
      title: this.contentForm.title.trim(),
      slug: this.contentForm.slug,
      description: this.contentForm.description?.trim() || null,
      posterUrl: this.contentForm.posterUrl?.trim() || null,
      bannerUrl: this.contentForm.bannerUrl?.trim() || null,
      tags: this.contentTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    this.api.categories().subscribe({
      next: (categories) => {
        this.categories = categories;
        const category = categories.find((x) => x.id === payload.categoryId) || categories[0];
        if (!category) {
          this.error = 'Create a category before adding content.';
          return;
        }

        payload.categoryId = category.id;
        this.contentForm.categoryId = category.id;
        this.submitContent(payload);
      },
      error: (err) => (this.error = this.apiError(err, 'Could not load categories before saving content.')),
    });
  }

  private submitContent(payload: SaveContent): void {
    if (this.editingContentId) {
      this.api.updateContent(this.editingContentId, payload).subscribe({
        next: () => {
          this.notice = 'Content updated successfully!';
          this.resetContentForm();
          this.loadAll();
          setTimeout(() => (this.notice = ''), 3000);
        },
        error: (err) => (this.error = this.apiError(err, 'Failed to update content.')),
      });
      return;
    }

    this.api.createContent(payload).subscribe({
      next: (created) => {
        this.notice = 'Content created successfully! You can now add seasons & episodes.';
        this.selectedContentForEpisodes = created;
        this.resetContentForm();
        this.loadAll();
        setTimeout(() => (this.notice = ''), 4000);
      },
      error: (err) => (this.error = this.apiError(err, 'Failed to create content.')),
    });
  }

  private apiError(err: { error?: { detail?: string; title?: string; errors?: Record<string, string[]> } | string }, fallback: string): string {
    const details = typeof err.error === 'string'
      ? err.error
      : err.error?.errors
      ? Object.values(err.error.errors).flat().join(' ')
      : err.error?.detail || err.error?.title;
    return details || fallback;
  }

  editContent(item: ApiContent): void {
    this.editingContentId = item.id;
    this.contentForm = {
      categoryId: item.categoryId,
      title: item.title,
      slug: item.slug,
      type: item.type,
      description: item.description || '',
      posterUrl: item.posterUrl || '',
      bannerUrl: item.bannerUrl || '',
      tags: item.tags || [],
      published: item.published,
    };
    this.contentTagsInput = (item.tags || []).join(', ');
    this.setTab('content');
  }

  deleteContent(item: ApiContent): void {
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    this.api.deleteContent(item.id).subscribe({
      next: () => {
        this.notice = `"${item.title}" deleted.`;
        this.loadAll();
        setTimeout(() => (this.notice = ''), 3000);
      },
      error: () => (this.error = 'Could not delete content.'),
    });
  }

  togglePublished(item: ApiContent): void {
    const updated: SaveContent = {
      categoryId: item.categoryId,
      title: item.title,
      slug: item.slug,
      type: item.type,
      description: item.description,
      posterUrl: item.posterUrl,
      bannerUrl: item.bannerUrl,
      tags: item.tags,
      published: !item.published,
    };
    this.api.updateContent(item.id, updated).subscribe({
      next: () => this.loadAll(),
    });
  }

  resetContentForm(): void {
    this.editingContentId = null;
    this.contentForm = {
      categoryId: this.categories[0]?.id || '',
      title: '',
      slug: '',
      type: 'Series',
      description: '',
      posterUrl: '',
      bannerUrl: '',
      tags: [],
      published: true,
    };
    this.contentTagsInput = '';
  }

  // ─── Seasons & Episodes ─────────────────────────────────────────────────────
  onContentSelect(contentId: string): void {
    const item = this.contentList.find((c) => c.id === contentId) || null;
    if (item) {
      this.selectContentForEpisodes(item);
    } else {
      this.selectedContentForEpisodes = null;
      this.contentDetailForEpisodes = null;
    }
  }

  selectContentForEpisodes(item: ApiContent): void {
    this.selectedContentForEpisodes = item;
    this.setTab('episodes');
    this.selectedEpisodeForSources = null;
    this.activeSeasonTabId = 'all';
    this.seasonForm = { number: 1, title: 'Season 1' };
    this.episodeForm = {
      number: 1,
      title: item.type === 'Movie' ? item.title : '',
      thumbnailUrl: item.posterUrl || '',
      durationSeconds: item.type === 'Movie' ? 7200 : 1440,
      published: true,
    };
    this.initialSource = {
      playerName: 'Vidmoly',
      url: '',
      embedType: 'Iframe',
      quality: '1080p',
    };
    this.refreshSelectedContentEpisodes();
  }

  refreshSelectedContentEpisodes(): void {
    if (!this.selectedContentForEpisodes) return;
    this.contentService.detail(this.selectedContentForEpisodes.slug).subscribe({
      next: (res) => {
        this.contentDetailForEpisodes = res.raw || null;
        const seasons = res.raw?.seasons ?? [];
        this.seasons = seasons.map((s) => ({ id: s.id, number: s.number, title: s.title }));
        if (this.seasons.length > 0) {
          if (!this.seasons.some((season) => season.id === this.selectedSeasonId)) {
            this.selectedSeasonId = this.seasons[0].id;
          }
          if (this.activeSeasonTabId !== 'all' && !this.seasons.some((season) => season.id === this.activeSeasonTabId)) {
            this.activeSeasonTabId = 'all';
          }
          this.seasonForm.number = this.seasons.length + 1;
          this.seasonForm.title = `Season ${this.seasonForm.number}`;
        } else {
          this.selectedSeasonId = '';
          this.activeSeasonTabId = 'all';
        }
        this.changeDetector.detectChanges();
      },
      error: (err) => {
        this.error = this.apiError(err, 'Failed to load seasons and episodes.');
        this.changeDetector.detectChanges();
      },
    });
  }

  get displayedSeasons(): ApiSeason[] {
    if (!this.contentDetailForEpisodes?.seasons) return [];
    if (!this.activeSeasonTabId || this.activeSeasonTabId === 'all') {
      return this.contentDetailForEpisodes.seasons;
    }
    const found = this.contentDetailForEpisodes.seasons.find((s) => s.id === this.activeSeasonTabId);
    return found ? [found] : this.contentDetailForEpisodes.seasons;
  }

  get totalEpisodesCount(): number {
    if (!this.contentDetailForEpisodes) return 0;
    if (this.selectedContentForEpisodes?.type === 'Movie') {
      return this.contentDetailForEpisodes.episodes?.length || 0;
    }
    return (this.contentDetailForEpisodes.seasons || []).reduce(
      (sum, s) => sum + (s.episodes?.length || 0),
      0
    );
  }

  setActiveSeasonTab(seasonId: string): void {
    this.activeSeasonTabId = seasonId;
    if (seasonId !== 'all') {
      this.selectedSeasonId = seasonId;
    }
  }

  addSeason(): void {
    if (!this.selectedContentForEpisodes) return;
    this.api.createSeason(this.selectedContentForEpisodes.id, this.seasonForm).subscribe({
      next: (s) => {
        this.seasons.push(s);
        this.selectedSeasonId = s.id;
        this.activeSeasonTabId = s.id;
        this.notice = `Season ${s.number} created!`;
        this.seasonForm.number++;
        this.seasonForm.title = `Season ${this.seasonForm.number}`;
        this.refreshSelectedContentEpisodes();
        setTimeout(() => (this.notice = ''), 3000);
      },
      error: () => (this.error = 'Failed to create season.'),
    });
  }

  addEpisode(): void {
    if (!this.selectedContentForEpisodes) return;

    if (this.selectedContentForEpisodes.type === 'Series' && !this.selectedSeasonId) {
      this.error = 'Please create or select a Season first for Series content.';
      return;
    }
    if (!this.episodeForm.title.trim()) {
      this.error = 'Episode title is required.';
      return;
    }
    if (this.episodeForm.number < 1) {
      this.error = 'Episode number must be at least 1.';
      return;
    }
    if (this.initialSource.url.trim() && !this.isValidUrl(this.initialSource.url)) {
      this.error = 'Video URL must be a complete URL starting with http:// or https://.';
      return;
    }

    const obs = this.selectedContentForEpisodes.type === 'Movie'
      ? this.api.createEpisodeForMovie(this.selectedContentForEpisodes.id, this.episodeForm)
      : this.api.createEpisode(this.selectedSeasonId, this.episodeForm);

    obs.subscribe({
      next: (created) => {
        this.notice = `Episode "${this.episodeForm.title}" added!`;

        if (this.initialSource.url.trim() && created?.id) {
          this.api.createSource(created.id, {
            playerName: this.initialSource.playerName.trim() || 'Direct Player',
            url: this.initialSource.url.trim(),
            embedType: this.initialSource.embedType,
            quality: this.initialSource.quality?.trim() || null,
            sortOrder: 0,
            isActive: true,
          }).subscribe({
            next: () => this.refreshSelectedContentEpisodes(),
          });
        } else {
          this.refreshSelectedContentEpisodes();
        }

        this.episodeForm = {
          number: this.episodeForm.number + 1,
          title: '',
          thumbnailUrl: '',
          durationSeconds: 1440,
          published: true,
        };
        this.initialSource.url = '';
        setTimeout(() => (this.notice = ''), 4000);
      },
      error: (err) => (this.error = this.apiError(err, 'Failed to add episode.')),
    });
  }

  bulkAddEpisodes(): void {
    if (!this.selectedSeasonId) {
      this.error = 'Select a season before importing URLs.';
      return;
    }
    const urls = this.bulkUrls.split(/\\r?\\n/).map((url) => url.trim()).filter(Boolean);
    if (urls.length === 0) {
      this.error = 'Paste at least one video URL, one per line.';
      return;
    }
    const invalidUrl = urls.find((url) => !this.isValidUrl(url));
    if (invalidUrl) {
      this.error = `Invalid video URL: ${invalidUrl}`;
      return;
    }
    this.api.bulkCreateEpisodes(this.selectedSeasonId, {
      urls,
      thumbnailUrl: this.bulkThumbnailUrl.trim() || '',
      playerName: this.bulkPlayerName.trim() || 'Vidmoly',
      embedType: this.bulkEmbedType,
    }).subscribe({
      next: (created) => {
        this.notice = `${created.length} episodes imported from URLs.`;
        this.bulkUrls = '';
        this.bulkThumbnailUrl = '';
        this.refreshSelectedContentEpisodes();
        setTimeout(() => (this.notice = ''), 4000);
      },
      error: (err) => (this.error = this.apiError(err, 'Failed to import episode URLs.')),
    });
  }

  private isValidUrl(value: string): boolean {
    try {
      const url = new URL(value.trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  deleteEpisode(episodeId: string): void {
    if (!confirm('Are you sure you want to delete this episode?')) return;
    this.api.deleteEpisode(episodeId).subscribe({
      next: () => {
        this.notice = `Episode deleted.`;
        if (this.selectedEpisodeForSources?.id === episodeId) {
          this.selectedEpisodeForSources = null;
        }
        this.refreshSelectedContentEpisodes();
        setTimeout(() => (this.notice = ''), 3000);
      },
      error: () => (this.error = 'Could not delete episode.'),
    });
  }

  // ─── Video Sources Management ───────────────────────────────────────────────
  manageSources(ep: { id: string; title: string; number: number }): void {
    this.selectedEpisodeForSources = ep;
    this.loadEpisodeSources(ep.id);
  }

  closeSourceManager(): void {
    this.selectedEpisodeForSources = null;
    this.episodeSources = [];
  }

  loadEpisodeSources(episodeId: string): void {
    this.api.getEpisodeSources(episodeId).subscribe({
      next: (sources) => {
        this.episodeSources = sources;
        this.newSourceForm.sortOrder = sources.length;
      },
      error: () => (this.error = 'Could not load video sources.'),
    });
  }

  addSource(): void {
    if (!this.selectedEpisodeForSources) return;
    if (!this.newSourceForm.url.trim()) {
      this.error = 'Source stream / embed URL is required.';
      return;
    }

    this.api.createSource(this.selectedEpisodeForSources.id, {
      ...this.newSourceForm,
      playerName: this.newSourceForm.playerName.trim() || 'Player',
      url: this.newSourceForm.url.trim(),
      quality: this.newSourceForm.quality?.trim() || null,
      sortOrder: this.episodeSources.length,
    }).subscribe({
      next: () => {
        this.notice = 'Video source added!';
        this.newSourceForm = {
          playerName: 'Vidmoly',
          url: '',
          embedType: 'Iframe',
          quality: '1080p',
          sortOrder: 0,
          isActive: true,
        };
        this.loadEpisodeSources(this.selectedEpisodeForSources!.id);
        this.refreshSelectedContentEpisodes();
        setTimeout(() => (this.notice = ''), 3000);
      },
      error: (err) => (this.error = this.apiError(err, 'Failed to add video source.')),
    });
  }

  toggleSourceActive(source: AdminVideoSource): void {
    this.api.updateSource(source.id, {
      playerName: source.playerName,
      url: source.url,
      embedType: source.embedType,
      quality: source.quality,
      sortOrder: source.sortOrder,
      isActive: !source.isActive,
    }).subscribe({
      next: () => {
        source.isActive = !source.isActive;
        this.refreshSelectedContentEpisodes();
      },
      error: () => (this.error = 'Failed to update source active state.'),
    });
  }

  deleteSource(sourceId: string): void {
    if (!confirm('Delete this video source?')) return;
    this.api.deleteSource(sourceId).subscribe({
      next: () => {
        this.notice = 'Video source removed.';
        if (this.selectedEpisodeForSources) {
          this.loadEpisodeSources(this.selectedEpisodeForSources.id);
        }
        this.refreshSelectedContentEpisodes();
        setTimeout(() => (this.notice = ''), 3000);
      },
      error: () => (this.error = 'Could not delete video source.'),
    });
  }

  moveSource(index: number, direction: 'up' | 'down'): void {
    if (!this.selectedEpisodeForSources) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= this.episodeSources.length) return;

    const list = [...this.episodeSources];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const orderedIds = list.map((s) => s.id);
    this.api.reorderSources(this.selectedEpisodeForSources.id, orderedIds).subscribe({
      next: () => {
        this.loadEpisodeSources(this.selectedEpisodeForSources!.id);
        this.refreshSelectedContentEpisodes();
      },
      error: () => (this.error = 'Failed to reorder sources.'),
    });
  }
}

export const ADMIN_ROUTES: Routes = [
  { path: '', component: AdminComponent },
  { path: '**', component: AdminComponent },
];
