import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { signToken } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';

export const authRoutes = new Hono<{
  Bindings: { DATABASE_URL: string; JWT_SECRET: string };
  Variables: { db: any }
}>();

// POST /api/auth/register
authRoutes.post('/register', async (c) => {
  const db = c.get('db');
  if (!db) return c.json({ error: 'Database not available' }, 500);

  const body = await c.req.json().catch(() => ({}));
  const { email, password, displayName } = body;
  if (!email || !password) return c.json({ error: 'Email and password are required' }, 400);

  const trimmedEmail = String(email).trim().toLowerCase();

  const existing = await db.select()
    .from(schema.users)
    .where(sql`LOWER(${schema.users.email}) = ${trimmedEmail}`)
    .limit(1);
  if (existing[0]) return c.json({ error: 'Email already registered' }, 400);

  const passwordHash = await hashPassword(String(password));
  const secret = (c.env as any)?.JWT_SECRET;

  const [user] = await db.insert(schema.users).values({
    email: String(email).trim(),
    userName: String(email).trim(),
    normalizedEmail: String(email).trim().toUpperCase(),
    normalizedUserName: String(email).trim().toUpperCase(),
    displayName: displayName ? String(displayName).trim() : String(email).split('@')[0],
    role: 'User',
    passwordHash,
    emailConfirmed: false,
    phoneNumberConfirmed: false,
    twoFactorEnabled: false,
    lockoutEnabled: false,
    accessFailedCount: 0,
    createdAt: new Date(),
  }).returning();

  const token = await signToken({ id: user.id, email: user.email, role: user.role }, secret);
  return c.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } }, 201);
});

// POST /api/auth/login
authRoutes.post('/login', async (c) => {
  const db = c.get('db');
  if (!db) return c.json({ error: 'Database not available' }, 500);

  const body = await c.req.json().catch(() => ({}));
  const { email, password } = body;
  if (!email || !password) return c.json({ error: 'Email and password are required' }, 400);

  const trimmedEmail = String(email).trim().toLowerCase();
  const users = await db.select()
    .from(schema.users)
    .where(sql`LOWER(${schema.users.email}) = ${trimmedEmail}`)
    .limit(1);

  if (!users[0] || !users[0].passwordHash) return c.json({ error: 'Invalid credentials' }, 401);

  const isValid = await verifyPassword(String(password), users[0].passwordHash);
  if (!isValid) return c.json({ error: 'Invalid credentials' }, 401);

  const secret = (c.env as any)?.JWT_SECRET;
  const token = await signToken({ id: users[0].id, email: users[0].email, role: users[0].role }, secret);
  return c.json({ token, user: { id: users[0].id, email: users[0].email, displayName: users[0].displayName, role: users[0].role } });
});

// POST /api/auth/refresh
authRoutes.post('/refresh', async (c) => {
  return c.json({ error: 'Refresh not implemented in v1 — re-login to get a new token' }, 501);
});
