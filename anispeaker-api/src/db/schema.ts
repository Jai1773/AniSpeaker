import { pgTable, uuid, varchar, integer, boolean, timestamp, text, jsonb } from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Table names & column names MUST match the PostgreSQL DB exactly
// (PascalCase), because EF Core created the tables with quoted identifiers.
// ─────────────────────────────────────────────────────────────────────────────

export const categories = pgTable('Categories', {
  id: uuid('Id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar('Name', { length: 255 }).notNull(),
  slug: text('Slug').notNull().unique(),
  sortOrder: integer('SortOrder').notNull().default(0),
});

export const content = pgTable('Content', {
  id: uuid('Id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  categoryId: uuid('CategoryId').references(() => categories.id).notNull(),
  title: text('Title').notNull(),
  slug: text('Slug').notNull().unique(),
  type: text('Type').notNull(), // 'Series' | 'Movie'
  description: text('Description'),
  posterUrl: text('PosterUrl'),
  bannerUrl: text('BannerUrl'),
  tags: text('Tags').array().notNull().default([]),
  published: boolean('Published').notNull().default(false),
  createdAt: timestamp('CreatedAt', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('UpdatedAt', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  catalogJson: jsonb('CatalogJson'),
});

export const seasons = pgTable('Seasons', {
  id: uuid('Id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  contentId: uuid('ContentId').references(() => content.id).notNull(),
  number: integer('Number').notNull(),
  title: text('Title').notNull(),
});

export const episodes = pgTable('Episodes', {
  id: uuid('Id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  contentId: uuid('ContentId').references(() => content.id).notNull(),
  seasonId: uuid('SeasonId').references(() => seasons.id),
  number: integer('Number').notNull(),
  title: text('Title').notNull(),
  thumbnailUrl: text('ThumbnailUrl'),
  durationSeconds: integer('DurationSeconds').notNull().default(0),
  published: boolean('Published').notNull().default(false),
});

export const videoSources = pgTable('VideoSources', {
  id: uuid('Id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  episodeId: uuid('EpisodeId').references(() => episodes.id).notNull(),
  playerName: varchar('PlayerName', { length: 50 }).notNull(),
  url: varchar('Url', { length: 500 }).notNull(),
  quality: varchar('Quality', { length: 20 }),
  sortOrder: integer('SortOrder').notNull().default(0),
  isActive: boolean('IsActive').notNull().default(true),
  embedType: varchar('EmbedType', { length: 20 }).notNull().default('Iframe'),
});

export const users = pgTable('AspNetUsers', {
  id: uuid('Id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  displayName: text('DisplayName').notNull(),
  role: varchar('Role', { length: 50 }).notNull().default('User'),
  createdAt: timestamp('CreatedAt', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  userName: varchar('UserName', { length: 255 }),
  normalizedUserName: varchar('NormalizedUserName', { length: 255 }),
  email: varchar('Email', { length: 255 }),
  normalizedEmail: varchar('NormalizedEmail', { length: 255 }),
  emailConfirmed: boolean('EmailConfirmed').notNull().default(false),
  passwordHash: text('PasswordHash'),
  securityStamp: text('SecurityStamp'),
  concurrencyStamp: text('ConcurrencyStamp'),
  phoneNumber: text('PhoneNumber'),
  phoneNumberConfirmed: boolean('PhoneNumberConfirmed').notNull().default(false),
  twoFactorEnabled: boolean('TwoFactorEnabled').notNull().default(false),
  lockoutEnd: timestamp('LockoutEnd', { withTimezone: true }),
  lockoutEnabled: boolean('LockoutEnabled').notNull().default(false),
  accessFailedCount: integer('AccessFailedCount').notNull().default(0),
});

export const watchHistory = pgTable('WatchHistory', {
  id: uuid('Id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: uuid('UserId').references(() => users.id).notNull(),
  episodeId: uuid('EpisodeId').references(() => episodes.id).notNull(),
  progressSeconds: integer('ProgressSeconds').notNull().default(0),
  lastWatchedAt: timestamp('LastWatchedAt', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
});

export const watchLater = pgTable('WatchLater', {
  id: uuid('Id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: uuid('UserId').references(() => users.id).notNull(),
  contentId: uuid('ContentId').references(() => content.id).notNull(),
  addedAt: timestamp('AddedAt', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
});

export const refreshTokens = pgTable('RefreshTokens', {
  id: uuid('Id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: uuid('UserId').references(() => users.id).notNull(),
  tokenHash: text('TokenHash').notNull(),
  expiresAt: timestamp('ExpiresAt', { withTimezone: true }).notNull(),
  revokedAt: timestamp('RevokedAt', { withTimezone: true }),
});
