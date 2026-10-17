import pino from 'pino';
import Redis from 'ioredis';
import { validateEnv } from '@chatpilot/config';

const logger = pino({
  name: 'chatpilot-worker',
  level: process.env['LOG_LEVEL'] || 'info',
});

async function bootstrap() {
  // 1. Boot-time environment validation
  const env = validateEnv();
  logger.info({ redis: env.REDIS_URL }, 'Starting ChatPilot background worker process');

  // 2. Redis connection test
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    logger.info('Connected to Redis successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown Redis error';
    logger.warn({ error: message }, 'Redis connect notice (will reconnect when available)');
  }

  // 3. Queue catalog registered for Phase P5 - P8
  const QUEUE_CATALOG = [
    'analytics-aggregate',
    'order-timeout-purge',
    'notifications',
    'webhook-ingest',
    'ai-process',
    'subscription-check',
  ];

  logger.info({ queues: QUEUE_CATALOG }, 'Worker queue catalog initialized');

  // 4. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down worker process...');
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  logger.info('ChatPilot background worker process is running and ready for jobs');
}

void bootstrap();
