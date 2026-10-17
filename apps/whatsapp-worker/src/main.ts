import pino from 'pino';
import Redis from 'ioredis';
import { validateEnv } from '@chatpilot/config';
import { WhatsAppConnectionStatus, WhatsAppProviderType } from '@chatpilot/contracts';
import { BaileysSessionManager } from './baileys-session-manager';

const logger = pino({
  name: 'chatpilot-whatsapp-worker',
  level: process.env['LOG_LEVEL'] || 'info',
});

async function bootstrap() {
  // 1. Boot-time environment validation
  const env = validateEnv();
  logger.info(
    { port: env.WHATSAPP_WORKER_PORT, provider: WhatsAppProviderType.REGULAR_QR_PAIRING },
    'Starting dedicated WhatsApp Baileys multi-device worker process (D-21)',
  );

  // 2. Redis pub/sub & connection health tracking
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    logger.info('Connected to Redis for WhatsApp session pub/sub');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown Redis error';
    logger.warn({ error: message }, 'Redis connect notice (will reconnect when available)');
  }

  // 3. Multi-device Session Engine Manager initialized (D-21)
  const sessionManager = new BaileysSessionManager();

  logger.info(
    {
      isolation: 'dedicated-container',
      encryption: 'SecretsService-envelope',
      status: WhatsAppConnectionStatus.DISCONNECTED,
    },
    'Baileys multi-device socket container initialized and isolated from HTTP API',
  );

  // 4. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down WhatsApp worker process...');
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void bootstrap();
