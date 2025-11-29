import type { Config } from 'drizzle-kit';
import 'dotenv/config';

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

// Neon's pooled connection string can include an `options` parameter that is
// incompatible with some database tools. This logic safely removes it to ensure
// compatibility, creating a clean connection string.
const url = new URL(process.env.POSTGRES_URL);
url.searchParams.delete('options');
const cleanUrl = url.toString();

export default {
  schema: './db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    // Using `url` is the correct property for the connection string, which delegates
    // all parsing to the underlying `pg` driver, correctly handling SSL and other parameters.
    url: cleanUrl,
  },
  out: './drizzle',
  verbose: true,
  strict: true,
} satisfies Config;
