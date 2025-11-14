import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildServer } from '../src/server';

let appPromise: ReturnType<typeof buildServer> | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!appPromise) {
    appPromise = buildServer();
  }
  const app = await appPromise;
  await app.ready();
  app.server.emit('request', req, res);
}



