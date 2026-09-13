export type ContentType = 'Anime' | 'Cartoon' | 'Movie';
export type ApiContentType = 'Series' | 'Movie';
export interface Content {
  id: string | number;
  slug: string;
  title: string;
  type: ContentType;
  year: number;
  rating: number;
  duration: string;
  genre: string;
  image: string;
  backdrop: string;
  description: string;
  progress?: number;
  episode?: string;
}
export interface Episode {
  number: number;
  title: string;
  duration: string;
  description: string;
  image: string;
  progress?: number;
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
  number: number;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  published: boolean;
}

export interface ApiContentDetail extends ApiContent {
  episodes: ApiEpisode[];
  seasons: { id: string; number: number; title: string; episodes: ApiEpisode[] }[];
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}
