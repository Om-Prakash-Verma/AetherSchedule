import { Hono } from 'hono';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';

export const authRoutes = new Hono();

// Auth
authRoutes.post('/login', async (c) => {
  const { email } = await c.req.json();
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user) {
    return c.json({ message: 'User not found' }, 404);
  }
  return c.json(user);
});
