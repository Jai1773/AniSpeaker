import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getDb } from './db/client';
import { contentRoutes } from './routes/content';
import { playbackRoutes } from './routes/playback';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { accountRoutes } from './routes/account';
import { sql, and, eq } from 'drizzle-orm';
import * as schema from './db/schema';

type Bindings = {
  DATABASE_URL: string;
  CACHE_KV: KVNamespace;
  MEDIA_BUCKET: R2Bucket;
  JWT_SECRET: string;
};

type Variables = {
  db: any;
  user?: any;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 1. CORS — allow Angular dev server and any origin
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// 2. Logging
app.use('*', async (c, next) => {
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.url}`);
  await next();
});

// 3. Database injection — reads DATABASE_URL from Wrangler bindings (.dev.vars in dev)
app.use('*', async (c, next) => {
  const dbUrl = c.env?.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is missing from Wrangler environment bindings');
    return await next();
  }
  try {
    const db = getDb(dbUrl);
    c.set('db', db);
  } catch (e) {
    console.error('Failed to initialize DB client:', e);
  }
  await next();
});

// 4. Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    error: err.message || 'Internal Server Error',
    cause: (err as any).cause?.message,
  }, 500);
});

// 5. Routes
app.route('/api/content', contentRoutes);
app.route('/api/playback', playbackRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/account', accountRoutes);

// Direct /api/search alias (frontend calls /api/search?q=... not /api/content/search)
app.get('/api/search', async (c) => {
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

// Health check
app.get('/', (c) => c.text('AniSpeaker API is running!'));

export default app;
