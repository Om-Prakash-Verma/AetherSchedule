import 'dotenv/config';
import { serve } from '@hono/node-server'
import { app } from './server'

const port = 8787;

console.log(`Preparing Hono dev server...`);

serve({
  fetch: app.fetch,
  port: port
}, (info) => {
    console.log(`[dev:api] Hono API server is running at http://localhost:${info.port}`);
});