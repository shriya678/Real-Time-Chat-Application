import { createServer } from 'http';
import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { initSockets } from './sockets/index.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function bootstrap() {
  await connectDB();

  const app = createApp();
  const httpServer = createServer(app);
  const io = initSockets(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`server listening on http://localhost:${env.PORT}`);
  });

  const shutdown = (signal) => {
    logger.info(`received ${signal}, shutting down`);
    io.close(() => {
      httpServer.close(async () => {
        await disconnectDB();
        logger.info('shutdown complete');
        process.exit(0);
      });
    });

    setTimeout(() => {
      logger.error('forced shutdown after timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[fatal] bootstrap failed', err);
  process.exit(1);
});
