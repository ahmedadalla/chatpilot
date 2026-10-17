import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  WEB_PORT: z.coerce.number().default(3000),
  WHATSAPP_WORKER_PORT: z.coerce.number().default(3002),

  // Database DSNs
  DATABASE_URL: z.string().url().describe('Runtime DSN for chatpilot_app role'),
  DATABASE_URL_MIGRATOR: z.string().url().describe('Migrator DSN for chatpilot_migrator role'),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().default(604800),
  KMS_MASTER_KEY: z.string().min(16).default('local_dev_kms_master_key_32_bytes_min=='),

  // Storage
  S3_BUCKET: z.string().default('chatpilot-uploads'),
  S3_REGION: z.string().default('auto'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // Regional & Localization defaults (Q-REQ-6)
  DEFAULT_COUNTRY: z.string().default('EG'),
  DEFAULT_CURRENCY: z.string().default('EGP'),
  DEFAULT_TIMEZONE: z.string().default('Africa/Cairo'),
  DEFAULT_LOCALE: z.string().default('ar-EG'),
  DEFAULT_CALLING_CODE: z.string().default('+20'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validateEnv(envInput: Record<string, unknown> = process.env): EnvConfig {
  const result = EnvSchema.safeParse(envInput);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`[Configuration Error] Boot-time environment validation failed:\n${errorDetails}`);
  }
  return result.data;
}
