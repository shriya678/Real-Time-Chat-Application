import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { getDbStatus } from './config/db.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { messageRoutes } from './routes/messages.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(morgan(env.IS_PRODUCTION ? 'combined' : 'dev'));

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      db: getDbStatus(),
      env: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/messages', messageRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
