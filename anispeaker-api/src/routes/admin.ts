import { Hono } from 'hono';
import { eq, and, sql, desc, count } from 'drizzle-orm';
import * as schema from '../db/schema';

export const adminRoutes = new Hono<{
  Bindings: { DATABASE_URL: string; MEDIA_BUCKET: R2Bucket };
  Variables: { db: any }
}>();

// ── Categories ──────────────────────────────────────────────────────────────

adminRoutes.get('/categories', async (c) => {
  const db = c.get('db');
  if (!db) return c.json({ error: 'Database not available' }, 500);
  const results = await db.select().from(schema.categories).orderBy(schema.categories.sortOrder);
  return c.json(results);
});

adminRoutes.post('/categories', async (c) => {
  const db = c.get('db');
  if (!db) return c.json({ error: 'Database not available' }, 500);
  const body = await c.req.json().catch(() => ({}));
  if (!body.name || !body.slug) return c.json({ error: 'name and slug are required' }, 400);
  const [row] = await db.insert(schema.categories).values({
    name: body.name, slug: body.slug, sortOrder: body.sortOrder ?? 0,
  }).returning();
  return c.json(row, 201);
});

adminRoutes.put('/categories/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const update: any = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.slug !== undefined) update.slug = body.slug;
  if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder;
  const [row] = await db.update(schema.categories).set(update).where(eq(schema.categories.id, id)).returning();
  return c.json(row ?? { success: true });
});

adminRoutes.delete('/categories/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  await db.delete(schema.categories).where(eq(schema.categories.id, id));
  return c.json({ success: true });
});

// ── Content ──────────────────────────────────────────────────────────────────

adminRoutes.get('/content', async (c) => {
  const db = c.get('db');
  if (!db) return c.json({ error: 'Database not available' }, 500);

  const search = c.req.query('search')?.trim();
  const category = c.req.query('category');
  const type = c.req.query('type');
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') ?? '50', 10)));

  const conditions: any[] = [];
  if (search) conditions.push(sql`${schema.content.title} ILIKE ${`%${search}%`}`);
  if (category) conditions.push(eq(schema.content.categoryId, category));
  if (type) conditions.push(sql`LOWER(${schema.content.type}) = LOWER(${type})`);

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(schema.content).where(where);
  const items = await db.select().from(schema.content).where(where)
    .orderBy(desc(schema.content.createdAt)).limit(pageSize).offset((page - 1) * pageSize);

  return c.json({ items: items.map((i: any) => ({ ...i, tags: Array.isArray(i.tags) ? i.tags : [] })), page, pageSize, totalCount: Number(total) });
});

adminRoutes.post('/content', async (c) => {
  const db = c.get('db');
  if (!db) return c.json({ error: 'Database not available' }, 500);
  const body = await c.req.json().catch(() => ({}));
  if (!body.title || !body.slug || !body.categoryId || !body.type) {
    return c.json({ error: 'title, slug, categoryId, and type are required' }, 400);
  }
  const tags = Array.isArray(body.tags) ? body.tags
    : (body.tags ? String(body.tags).split(',').map((t: string) => t.trim()) : []);
  const [row] = await db.insert(schema.content).values({
    title: body.title, slug: body.slug, type: body.type,
    description: body.description ?? null, posterUrl: body.posterUrl ?? null,
    bannerUrl: body.bannerUrl ?? null, tags, categoryId: body.categoryId,
    published: body.published ?? false, createdAt: new Date(), updatedAt: new Date(),
  }).returning();
  return c.json(row, 201);
});

adminRoutes.put('/content/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const update: any = { updatedAt: new Date() };
  const fields = ['title', 'slug', 'type', 'description', 'posterUrl', 'bannerUrl', 'categoryId', 'published'];
  fields.forEach(f => { if (body[f] !== undefined) update[f] = body[f]; });
  if (body.tags !== undefined) {
    update.tags = Array.isArray(body.tags) ? body.tags : String(body.tags).split(',').map((t: string) => t.trim());
  }
  const [row] = await db.update(schema.content).set(update).where(eq(schema.content.id, id)).returning();
  return c.json(row ?? { success: true });
});

adminRoutes.delete('/content/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  await db.delete(schema.content).where(eq(schema.content.id, id));
  return c.json({ success: true });
});

// ── Seasons ──────────────────────────────────────────────────────────────────

adminRoutes.post('/content/:id/seasons', async (c) => {
  const db = c.get('db');
  const contentId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const [row] = await db.insert(schema.seasons).values({
    contentId, number: body.number ?? 1, title: body.title || `Season ${body.number ?? 1}`,
  }).returning();
  return c.json(row, 201);
});

// ── Episodes ─────────────────────────────────────────────────────────────────

adminRoutes.post('/seasons/:id/episodes', async (c) => {
  const db = c.get('db');
  const seasonId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, seasonId)).limit(1);
  if (!season) return c.json({ error: 'Season not found' }, 404);
  const [ep] = await db.insert(schema.episodes).values({
    contentId: season.contentId, seasonId, number: body.number ?? 1,
    title: body.title || `Episode ${body.number ?? 1}`,
    thumbnailUrl: body.thumbnailUrl ?? null, durationSeconds: body.durationSeconds ?? 0, published: body.published ?? true,
  }).returning();
  return c.json({ id: ep.id }, 201);
});

// Movie direct episode
adminRoutes.post('/content/:id/episodes', async (c) => {
  const db = c.get('db');
  const contentId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const [ep] = await db.insert(schema.episodes).values({
    contentId, seasonId: null, number: body.number ?? 1,
    title: body.title || 'Full Movie',
    thumbnailUrl: body.thumbnailUrl ?? null, durationSeconds: body.durationSeconds ?? 0, published: body.published ?? true,
  }).returning();
  return c.json({ id: ep.id }, 201);
});

// Bulk Vidmoly URL import (Architecture §6)
adminRoutes.post('/seasons/:id/episodes/bulk-urls', async (c) => {
  const db = c.get('db');
  if (!db) return c.json({ error: 'Database not available' }, 500);
  const seasonId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const urls: string[] = Array.isArray(body.urls) ? body.urls
    : (Array.isArray(body.items) ? body.items.map((i: any) => i.url) : []);
  const playerName = body.playerName || 'Vidmoly';
  const embedType = body.embedType || 'Iframe';
  const thumbnailUrl = body.thumbnailUrl ?? null;

  if (urls.length === 0) return c.json({ error: 'urls array cannot be empty' }, 400);

  const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, seasonId)).limit(1);
  if (!season) return c.json({ error: 'Season not found' }, 404);

  const existingEps = await db.select({ number: schema.episodes.number })
    .from(schema.episodes).where(eq(schema.episodes.contentId, season.contentId));
  const maxNum = existingEps.reduce((m: number, e: any) => Math.max(m, e.number), 0);

  const created: any[] = [];
  for (let i = 0; i < urls.length; i++) {
    const epNum = maxNum + 1 + i;
    const title = body.items?.[i]?.title || `Episode ${epNum}`;
    const [ep] = await db.insert(schema.episodes).values({
      contentId: season.contentId, seasonId, number: epNum, title, thumbnailUrl,
      durationSeconds: 1440, published: true,
    }).returning();
    await db.insert(schema.videoSources).values({
      episodeId: ep.id, playerName, url: urls[i], embedType, sortOrder: 0, isActive: true,
    });
    created.push(ep);
  }
  return c.json(created, 201);
});

adminRoutes.put('/episodes/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const update: any = {};
  ['number', 'title', 'thumbnailUrl', 'durationSeconds', 'published'].forEach(f => {
    if (body[f] !== undefined) update[f] = body[f];
  });
  await db.update(schema.episodes).set(update).where(eq(schema.episodes.id, id));
  return c.json({ success: true });
});

adminRoutes.delete('/episodes/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  await db.delete(schema.episodes).where(eq(schema.episodes.id, id));
  return c.json({ success: true });
});

// ── Video Sources ─────────────────────────────────────────────────────────────

adminRoutes.get('/episodes/:id/sources', async (c) => {
  const db = c.get('db');
  const episodeId = c.req.param('id');
  const sources = await db.select().from(schema.videoSources)
    .where(eq(schema.videoSources.episodeId, episodeId))
    .orderBy(schema.videoSources.sortOrder);
  return c.json(sources);
});

adminRoutes.post('/episodes/:id/sources', async (c) => {
  const db = c.get('db');
  const episodeId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const [row] = await db.insert(schema.videoSources).values({
    episodeId, playerName: body.playerName || 'Vidmoly', url: body.url,
    embedType: body.embedType || 'Iframe', quality: body.quality ?? null,
    sortOrder: body.sortOrder ?? 0, isActive: body.isActive ?? true,
  }).returning();
  return c.json(row, 201);
});

adminRoutes.put('/sources/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const update: any = {};
  ['playerName', 'url', 'embedType', 'quality', 'sortOrder', 'isActive'].forEach(f => {
    if (body[f] !== undefined) update[f] = body[f];
  });
  await db.update(schema.videoSources).set(update).where(eq(schema.videoSources.id, id));
  return c.json({ success: true });
});

adminRoutes.delete('/sources/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  await db.delete(schema.videoSources).where(eq(schema.videoSources.id, id));
  return c.json({ success: true });
});

adminRoutes.put('/episodes/:id/sources/reorder', async (c) => {
  const db = c.get('db');
  const { orderedSourceIds } = await c.req.json().catch(() => ({ orderedSourceIds: [] }));
  if (Array.isArray(orderedSourceIds)) {
    for (let i = 0; i < orderedSourceIds.length; i++) {
      await db.update(schema.videoSources).set({ sortOrder: i })
        .where(eq(schema.videoSources.id, orderedSourceIds[i]));
    }
  }
  return c.json({ success: true });
});

// ── R2 Upload Init ────────────────────────────────────────────────────────────

adminRoutes.post('/uploads/init', async (c) => {
  const { fileName = 'upload.jpg', folder = 'images' } = await c.req.json().catch(() => ({}));
  const objectKey = `${folder}/${Date.now()}-${fileName}`;
  return c.json({
    uploadUrl: `https://r2.anispeaker.workers.dev/upload/${objectKey}`,
    publicUrl: `https://cdn.anispeaker.com/${objectKey}`,
    objectKey,
  });
});
