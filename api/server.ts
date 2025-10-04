import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Import modular route handlers
import { authRoutes } from './routes/auth';
import { dataRoutes } from './routes/data';
import { schedulerRoutes } from './routes/scheduler';
import { timetableRoutes } from './routes/timetables';
import { constraintRoutes } from './routes/constraints';
import { settingsRoutes } from './routes/settings';
import { systemRoutes } from './routes/system';

// Re-export the seeder function to maintain a consistent import path for scripts.
export { seedDatabaseIfEmpty } from './seeder';

// --- APP INITIALIZATION ---
export const app = new Hono().basePath('/api');

// --- MIDDLEWARE ---
// CORS for local development
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'], // Vite dev and preview ports
  credentials: true,
}));

// Global error handling
app.onError((err, c) => {
  console.error(`${c.req.method} ${c.req.url}`, err);
  return c.json({ message: err.message || 'An internal server error occurred' }, 500);
});

// --- ROUTE MOUNTING ---
app.route('/', authRoutes);
app.route('/', dataRoutes);
app.route('/scheduler', schedulerRoutes);
app.route('/', timetableRoutes);
app.route('/', constraintRoutes);
app.route('/settings', settingsRoutes);
app.route('/', systemRoutes);
