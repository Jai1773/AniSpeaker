import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';

export const accountRoutes = new Hono<{
  Bindings: { DATABASE_URL: string };
  Variables: { db: any; user: any }
}>();

accountRoutes.use('*', authMiddleware);

// GET /api/account/history
accountRoutes.get('/history', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  if (!db) return c.json({ error: 'Database not available' }, 500);

  const history = await db.select()
    .from(schema.watchHistory)
    .where(eq(schema.watchHistory.userId, user.id))
    .orderBy(desc(schema.watchHistory.lastWatchedAt));

  return c.json(history);
});

// POST /api/account/history
accountRoutes.post('/history', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  if (!db) return c.json({ error: 'Database not available' }, 500);

  const { episodeId, progressSeconds } = await c.req.json().catch(() => ({}));
  if (!episodeId) return c.json({ error: 'episodeId is required' }, 400);

  const [epExists] = await db.select({ id: schema.episodes.id })
    .from(schema.episodes).where(eq(schema.episodes.id, episodeId)).limit(1);
  if (!epExists) return c.json({ error: 'Episode not found' }, 404);

  const [existing] = await db.select().from(schema.watchHistory)
    .where(and(eq(schema.watchHistory.userId, user.id), eq(schema.watchHistory.episodeId, episodeId)))
    .limit(1);

  if (existing) {
    await db.update(schema.watchHistory)
      .set({ progressSeconds: progressSeconds ?? 0, lastWatchedAt: new Date() })
      .where(eq(schema.watchHistory.id, existing.id));
  } else {
    await db.insert(schema.watchHistory).values({
      userId: user.id, episodeId, progressSeconds: progressSeconds ?? 0, lastWatchedAt: new Date(),
    });
  }
  return c.json({ success: true });
});

// GET /api/account/watch-later
accountRoutes.get('/watch-later', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  if (!db) return c.json({ error: 'Database not available' }, 500);

  const list = await db.select({
    id: schema.watchLater.id,
    userId: schema.watchLater.userId,
    contentId: schema.watchLater.contentId,
    addedAt: schema.watchLater.addedAt,
    content: schema.content,
  })
    .from(schema.watchLater)
    .leftJoin(schema.content, eq(schema.watchLater.contentId, schema.content.id))
    .where(eq(schema.watchLater.userId, user.id))
    .orderBy(desc(schema.watchLater.addedAt));

  return c.json(list);
});

// POST /api/account/watch-later
accountRoutes.post('/watch-later', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  if (!db) return c.json({ error: 'Database not available' }, 500);

  const { contentId } = await c.req.json().catch(() => ({}));
  if (!contentId) return c.json({ error: 'contentId is required' }, 400);

  const [contentExists] = await db.select({ id: schema.content.id })
    .from(schema.content).where(eq(schema.content.id, contentId)).limit(1);
  if (!contentExists) return c.json({ error: 'Content not found' }, 404);

  const [existing] = await db.select().from(schema.watchLater)
    .where(and(eq(schema.watchLater.userId, user.id), eq(schema.watchLater.contentId, contentId)))
    .limit(1);
  if (existing) return c.json({ message: 'Already in watch later' }, 400);

  await db.insert(schema.watchLater).values({ userId: user.id, contentId, addedAt: new Date() });
  return c.json({ success: true }, 201);
});

// DELETE /api/account/watch-later/:contentId
accountRoutes.delete('/watch-later/:contentId', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  if (!db) return c.json({ error: 'Database not available' }, 500);

  const contentId = c.req.param('contentId');
  await db.delete(schema.watchLater)
    .where(and(eq(schema.watchLater.userId, user.id), eq(schema.watchLater.contentId, contentId)));
  return c.json({ success: true });
});
