import 'dotenv/config';
import { serve } from '@hono/node-server'
import { app } from '../api/server'

const port = 8787;

console.log(`[dev:api] Starting Hono API server...`);

// The database is now seeded by a separate `npm run db:seed` script.
// This server is only responsible for handling API requests.
serve({
  fetch: app.fetch,
  port: port
}, (info) => {
    console.log(`[dev:api] Hono API server is running at http://localhost:${info.port}`);
});
