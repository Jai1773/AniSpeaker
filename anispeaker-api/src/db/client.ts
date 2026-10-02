import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export const getDb = (databaseUrl: string) => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined in environment bindings');
  }
  const client = neon(databaseUrl);
  return drizzle(client, { schema });
};
