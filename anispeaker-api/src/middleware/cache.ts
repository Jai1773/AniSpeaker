import type { Context, Next } from 'hono';

export const edgeCache = (ttlSeconds = 60) => {
  return async (c: Context, next: Next) => {
    const cache = typeof caches !== 'undefined' ? (caches as any).default : null;
    if (!cache) { await next(); return; }
    const key = new Request(c.req.url, c.req.raw);
    const hit = await cache.match(key);
    if (hit) return hit;
    await next();
    if (c.res.status === 200) {
      const clone = c.res.clone();
      clone.headers.set('Cache-Control', `public, max-age=${ttlSeconds}`);
      if (c.executionCtx?.waitUntil) c.executionCtx.waitUntil(cache.put(key, clone));
    }
  };
};
