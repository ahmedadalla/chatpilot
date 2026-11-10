import pino from 'pino';
import { PrismaClient } from '@chatpilot/database';
import { PasswordService } from '../auth/password.service';
import { TotpService } from '../auth/totp.service';

const logger = pino({ name: 'bootstrap-super-admin' });

export async function bootstrapSuperAdmin(prisma: PrismaClient): Promise<void> {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const bootstrapOverride = process.env['BOOTSTRAP_OVERRIDE'] === 'true';

  if (isProduction && !bootstrapOverride) {
    logger.info(
      'Production mode detected without BOOTSTRAP_OVERRIDE=true; skipping automatic bootstrap seed',
    );
    return;
  }

  const email = (process.env['SUPER_ADMIN_EMAIL'] || 'admin@chatpilot.io').toLowerCase().trim();
  const password = process.env['SUPER_ADMIN_PASSWORD'] || 'SuperAdmin_12345!Secure';

  const passwordService = new PasswordService();
  const totpService = new TotpService();

  const passwordHash = await passwordService.hash(password);
  const mfaSetup = totpService.generateSecret(email);

  // Use SECURITY DEFINER function to bypass RLS (users_policy blocks unscoped DML)
  const existingRow = await prisma.$queryRaw<{ id: string; email: string }[]>`
    SELECT * FROM platform_find_super_admin(${email})
  `;

  if (existingRow.length > 0) {
    logger.info('Super Admin account already exists; skipping bootstrap');
    return;
  }

  const newId = await prisma.$queryRaw<{ id: string }[]>`
    SELECT superadmin_create_user(
      ${email},
      'Platform Super Admin',
      ${passwordHash},
      ${mfaSetup.secret},
      ${JSON.stringify(mfaSetup.hashedRecoveryCodes)}::jsonb
    ) AS id
  `;

  if (!newId[0]) {
    throw new Error('superadmin_create_user returned no id');
  }

  logger.info(
    {
      userId: newId[0].id,
      email,
      totpSecret: mfaSetup.secret,
      recoveryCodes: mfaSetup.recoveryCodes,
    },
    'First Super Admin bootstrapped successfully (save these recovery codes!)',
  );
}

if (require.main === module) {
  const prisma = new PrismaClient();
  bootstrapSuperAdmin(prisma)
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error({ err }, 'Bootstrap failed');
      await prisma.$disconnect();
      process.exit(1);
    });
}
