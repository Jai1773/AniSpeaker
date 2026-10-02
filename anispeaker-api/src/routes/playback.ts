import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema';

export const playbackRoutes = new Hono<{
  Bindings: { DATABASE_URL: string };
  Variables: { db: any }
}>();

// GET /api/playback/:episodeId — active video sources for an episode
playbackRoutes.get('/:episodeId', async (c) => {
  const db = c.get('db');
  if (!db) return c.json({ error: 'Database not available' }, 500);

  const episodeId = c.req.param('episodeId');

  const sources = await db.select()
    .from(schema.videoSources)
    .where(
      and(
        eq(schema.videoSources.episodeId, episodeId),
        eq(schema.videoSources.isActive, true)
      )
    )
    .orderBy(schema.videoSources.sortOrder);

  if (!sources || sources.length === 0) {
    return c.json({ episodeId, sources: [], error: 'No active video sources found' }, 404);
  }

  return c.json({
    episodeId,
    sources,
    videoUrl: sources[0]?.url,
  });
});
