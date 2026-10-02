import type { Context, Next } from 'hono';
import { verifyToken } from '../lib/jwt';

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);

  const token = authHeader.substring(7).trim();
  const secret = (c.env as any)?.JWT_SECRET;
  const payload = await verifyToken(token, secret);
  if (!payload) return c.json({ error: 'Invalid or expired token' }, 401);

  c.set('user', payload);
  await next();
};

export const adminOnlyMiddleware = async (c: Context, next: Next) => {
  const user = c.get('user');
  if (!user || user.role !== 'Admin') return c.json({ error: 'Forbidden: Admin only' }, 403);
  await next();
};
