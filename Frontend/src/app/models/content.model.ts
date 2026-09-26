export type ContentType = 'Anime' | 'Cartoon' | 'Movie' | 'Series';
export type ApiContentType = 'Series' | 'Movie';
export type VideoEmbedType = 'Iframe' | 'Direct';

export interface Content {
  id: string;
  slug: string;
  title: string;
  type: ContentType;
  year?: number;
  rating?: number;
  duration?: string;
  genre?: string;
  image: string;
  backdrop: string;
  description: string;
  progress?: number;
  episode?: string;
  categoryId?: string;
}

export interface Episode {
  id: string;
  contentId: string;
  seasonId?: string | null;
  seasonNumber?: number;
  number: number;
  title: string;
  duration: string;
  durationSeconds: number;
  description?: string;
  image: string;
  progress?: number;
  videoUrl?: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface VideoSourceDto {
  id: string;
  playerName: string;
  url: string;
  embedType: VideoEmbedType;
  quality?: string | null;
  sortOrder: number;
}

export interface PlaybackSourcesDto {
  episodeId: string;
  sources: VideoSourceDto[];
}

export interface PlaybackDto {
  episodeId: string;
  sources?: VideoSourceDto[];
  videoUrl?: string;
  expiresAt?: string;
}

export interface ApiContent {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  type: ApiContentType;
  description: string | null;
  posterUrl: string | null;
  bannerUrl: string | null;
  tags: string[];
  published: boolean;
}

export interface ApiEpisode {
  id: string;
  contentId: string;
  seasonId: string | null;
  seasonNumber?: number;
  number: number;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  published: boolean;
  videoSources?: VideoSourceDto[];
}

export interface ApiSeason {
  id: string;
  number: number;
  title: string;
  episodes: ApiEpisode[];
}

export interface ApiContentDetail extends ApiContent {
  episodes: ApiEpisode[];
  seasons: ApiSeason[];
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}
