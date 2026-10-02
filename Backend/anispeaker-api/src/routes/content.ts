import { Hono } from 'hono';
import { eq, and, sql, desc } from 'drizzle-orm';
import * as schema from '../db/schema';

export const contentRoutes = new Hono<{
  Bindings: { DATABASE_URL: string };
  Variables: { db: any }
}>();

// GET /api/content — browse catalog
contentRoutes.get('/', async (c) => {
  const db = c.get('db');
  if (!db) return c.json({ error: 'Database not available' }, 500);

  const categoryParam = c.req.query('category');
  const typeParam = c.req.query('type');
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') ?? '50', 10)));

  const conditions: any[] = [eq(schema.content.published, true)];

  if (categoryParam) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryParam);
    if (isUuid) {
      conditions.push(eq(schema.content.categoryId, categoryParam));
    } else {
      const cat = await db.select().from(schema.categories)
        .where(sql`LOWER(${schema.categories.slug}) = LOWER(${categoryParam})`)
        .limit(1);
      if (cat[0]) {
        conditions.push(eq(schema.content.categoryId, cat[0].id));
      } else {
        return c.json([]);
      }
    }
  }

  if (typeParam) {
    conditions.push(sql`LOWER(${schema.content.type}) = LOWER(${typeParam})`);
  }

  const offset = (page - 1) * pageSize;
  const results = await db.select()
    .from(schema.content)
    .where(and(...conditions))
    .orderBy(desc(schema.content.createdAt))
    .limit(pageSize)
    .offset(offset);

  return c.json(results.map((item: any) => ({
    ...item,
    tags: Array.isArray(item.tags) ? item.tags : [],
  })));
});

// GET /api/content/search
contentRoutes.get('/search', async (c) => {
  const db = c.get('db');
  if (!db) return c.json({ error: 'Database not available' }, 500);

  const q = c.req.query('q')?.trim();
  if (!q) return c.json([]);

  const results = await db.select()
    .from(schema.content)
    .where(
      and(
        eq(schema.content.published, true),
        sql`${schema.content.title} ILIKE ${`%${q}%`}`
      )
    )
    .limit(20);

  return c.json(results.map((item: any) => ({
    ...item,
    tags: Array.isArray(item.tags) ? item.tags : [],
  })));
});

// GET /api/content/:slug — detail with nested seasons + episodes
contentRoutes.get('/:slug', async (c) => {
  const db = c.get('db');
  if (!db) return c.json({ error: 'Database not available' }, 500);

  const slug = c.req.param('slug')?.trim();
  if (!slug) return c.json({ error: 'Slug is required' }, 400);

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  const items = isUuid
    ? await db.select().from(schema.content).where(eq(schema.content.id, slug)).limit(1)
    : await db.select().from(schema.content)
        .where(sql`LOWER(${schema.content.slug}) = LOWER(${slug})`)
        .limit(1);

  if (!items[0]) return c.json({ error: 'Content not found' }, 404);

  const contentItem = { ...items[0], tags: Array.isArray(items[0].tags) ? items[0].tags : [] };

  const dbSeasons = await db.select().from(schema.seasons)
    .where(eq(schema.seasons.contentId, contentItem.id))
    .orderBy(schema.seasons.number);

  const dbEpisodes = await db.select().from(schema.episodes)
    .where(eq(schema.episodes.contentId, contentItem.id))
    .orderBy(schema.episodes.number);

  const seasonsWithEpisodes = dbSeasons.map((s: any) => ({
    ...s,
    episodes: dbEpisodes.filter((e: any) => e.seasonId === s.id),
  }));

  return c.json({
    ...contentItem,
    seasons: seasonsWithEpisodes,
    episodes: dbEpisodes,
  });
});
