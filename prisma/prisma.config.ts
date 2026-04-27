import { defineConfig } from '@prisma/internals';
import { loadEnvFile } from 'process';

// Load .env.local
loadEnvFile('.env.local');

export default defineConfig({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/goforth_nebula?schema=public',
    },
  },
});
