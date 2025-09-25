import { handle } from 'hono/vercel'
import { app } from './server'

export const config = {
  runtime: 'edge',
};

// The main app is now fully configured in server.ts.
// This entrypoint just exports the handler.
export default handle(app)
