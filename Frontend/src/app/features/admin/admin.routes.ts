import { Routes } from '@angular/router';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AdminService,
  Category,
  SaveContent,
  SaveEpisode,
  Season,
} from '../../core/services/admin.service';
import { ApiContent } from '../../models/content.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  private api = inject(AdminService);
  readonly auth = inject(AuthService);

  activeTab: 'dashboard' | 'categories' | 'content' | 'episodes' | 'upload' = 'dashboard';

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
  seasonForm = {
    number: 1,
    title: 'Season 1',
  };
  selectedSeasonId = '';
  episodeForm: SaveEpisode = {
    number: 1,
    title: '',
    videoKey: '',
    thumbnailUrl: '',
    durationSeconds: 1440,
    published: true,
  };

  // ─── Upload Widget ──────────────────────────────────────────────────────────
  uploading = false;
  uploadProgress = 0;
  uploadTargetFolder: 'videos' | 'images' | 'thumbnails' = 'videos';
  lastUploadedKey = '';
  lastUploadedUrl = '';

  ngOnInit(): void {
    // Only call the protected API if the session already says Admin.
    // The interceptor will attach the Bearer token automatically.
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
    // Admin confirmed – load data
    this.loadAll();
  }

  logoutAndRedirect(): void {
    this.auth.logout();
    this.error = '';
  }

  getSeriesCount(): number {
    return this.contentList.filter((x) => x.type === 'Series').length;
  }

  getMovieCount(): number {
    return this.contentList.filter((x) => x.type === 'Movie').length;
  }

  onContentSelect(id: string): void {
    this.selectedContentForEpisodes = this.contentList.find((x) => x.id === id) || null;
  }

  loadAll(): void {
    this.loading = true;
    this.error = '';

    this.api.categories().subscribe({
      next: (cats) => {
        this.error = '';
        this.categories = cats;
        if (!this.contentForm.categoryId && cats.length > 0) {
          this.contentForm.categoryId = cats[0].id;
        }
      },
      error: (err: { status?: number }) => {
        // Admin IS logged in — never say "Ensure you are signed in as Admin"
        if (err?.status === 401) {
          this.error = 'Session expired or token rejected. Please sign out and sign in again.';
        } else if (err?.status === 403) {
          this.error = 'Server denied access (403). Verify your account has the Admin role in the database.';
        } else {
          this.error = 'Could not reach the backend. Make sure the API server is running.';
        }
      },
    });

    this.api.content().subscribe({
      next: (res) => {
        this.contentList = res.items || [];
        this.loading = false;
      },
      error: () => {
        this.contentList = [];
        this.loading = false;
      },
    });
  }

  // ─── Category CRUD ─────────────────────────────────────────────────────────
  createCategory(): void {
    if (!this.catForm.name.trim()) {
      this.error = 'Category name is required.';
      return;
    }

    const slug =
      this.catForm.slug.trim() ||
      this.catForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    this.api.createCategory({
      name: this.catForm.name.trim(),
      slug,
      sortOrder: Number(this.catForm.sortOrder) || 0,
    }).subscribe({
      next: () => {
        this.notice = 'Category added!';
        this.catForm = { name: '', slug: '', sortOrder: this.categories.length };
        this.loadAll();
        setTimeout(() => (this.notice = ''), 3000);
      },
      error: () => (this.error = 'Could not create category.'),
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
      error: () => (this.error = 'Could not delete category.'),
    });
  }

  // ─── Content CRUD ──────────────────────────────────────────────────────────
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

  private apiError(err: { error?: { detail?: string; title?: string; errors?: Record<string, string[]> } }, fallback: string): string {
    const details = err.error?.errors
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
    this.activeTab = 'content';
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
  selectContentForEpisodes(item: ApiContent): void {
    this.selectedContentForEpisodes = item;
    this.activeTab = 'episodes';
    this.seasonForm = { number: 1, title: 'Season 1' };
    this.episodeForm = {
      number: 1,
      title: '',
      videoKey: this.lastUploadedKey || '',
      thumbnailUrl: '',
      durationSeconds: 1440,
      published: true,
    };
  }

  addSeason(): void {
    if (!this.selectedContentForEpisodes) return;
    this.api.createSeason(this.selectedContentForEpisodes.id, this.seasonForm).subscribe({
      next: (s) => {
        this.seasons.push(s);
        this.selectedSeasonId = s.id;
        this.notice = `Season ${s.number} created!`;
        this.seasonForm.number++;
        this.seasonForm.title = `Season ${this.seasonForm.number}`;
        setTimeout(() => (this.notice = ''), 3000);
      },
      error: () => (this.error = 'Failed to create season.'),
    });
  }

  addEpisode(): void {
    if (!this.selectedSeasonId) {
      this.error = 'Please create or select a Season first.';
      return;
    }
    if (!this.episodeForm.title.trim()) {
      this.error = 'Episode title is required.';
      return;
    }
    if (!this.episodeForm.videoKey.trim()) {
      this.error = 'Video Key or URL is required. Use the Upload tab or paste a stream URL.';
      return;
    }

    this.api.createEpisode(this.selectedSeasonId, this.episodeForm).subscribe({
      next: () => {
        this.notice = `Episode ${this.episodeForm.number} added!`;
        this.episodeForm = {
          number: this.episodeForm.number + 1,
          title: '',
          videoKey: '',
          thumbnailUrl: '',
          durationSeconds: 1440,
          published: true,
        };
        setTimeout(() => (this.notice = ''), 3000);
      },
      error: () => (this.error = 'Failed to add episode.'),
    });
  }

  // ─── Direct Storage Upload Widget ───────────────────────────────────────────
  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.uploading = true;
    this.uploadProgress = 0;
    this.error = '';

    this.api.initUpload(file, this.uploadTargetFolder).subscribe({
      next: (init) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', init.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        xhr.upload.onprogress = (progressEvent) => {
          if (progressEvent.lengthComputable) {
            this.uploadProgress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          }
        };

        xhr.onload = () => {
          this.uploading = false;
          if (xhr.status >= 200 && xhr.status < 300) {
            this.lastUploadedKey = init.objectKey;
            this.lastUploadedUrl = init.publicUrl;
            this.notice = `File uploaded! Key: ${init.objectKey}`;

            // Auto-fill forms if appropriate
            if (this.uploadTargetFolder === 'videos') {
              this.episodeForm.videoKey = init.objectKey;
            } else if (this.uploadTargetFolder === 'images') {
              this.contentForm.posterUrl = init.publicUrl;
            } else if (this.uploadTargetFolder === 'thumbnails') {
              this.episodeForm.thumbnailUrl = init.publicUrl;
            }
          } else {
            this.error = `Direct storage upload failed with status ${xhr.status}.`;
          }
        };

        xhr.onerror = () => {
          this.uploading = false;
          this.error = 'Network error during storage upload.';
        };

        xhr.send(file);
      },
      error: () => {
        this.uploading = false;
        this.error = 'Failed to initiate storage upload. Check R2 settings on backend.';
      },
    });
  }
}

export const ADMIN_ROUTES: Routes = [
  { path: '', component: AdminComponent },
  { path: '**', component: AdminComponent },
];
