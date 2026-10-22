import { serve } from '@hono/node-server';
import { app } from './app.js';
import { env } from './env.js';
import { connectDB } from './lib/db.js';

async function main(): Promise<void> {
  await connectDB();

  const { close } = serve({
    fetch: app.fetch,
    port: env.PORT,
  });

  console.log('carwash api listening', { port: env.PORT, env: env.NODE_ENV });
}

main();