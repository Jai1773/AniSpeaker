import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://neondb_owner:npg_KIjQdDAH19ZF@ep-weathered-sunset-a5aeopa8-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  },
});
