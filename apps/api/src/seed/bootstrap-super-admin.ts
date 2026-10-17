import pino from 'pino';
import { PrismaClient, Role } from '@chatpilot/database';
import { PasswordService } from '../auth/password.service';
import { TotpService } from '../auth/totp.service';

const logger = pino({ name: 'bootstrap-super-admin' });

export async function bootstrapSuperAdmin(prisma: PrismaClient): Promise<void> {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const bootstrapOverride = process.env['BOOTSTRAP_OVERRIDE'] === 'true';

  if (isProduction && !bootstrapOverride) {
    logger.info('Production mode detected without BOOTSTRAP_OVERRIDE=true; skipping automatic bootstrap seed');
    return;
  }

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: Role.SUPER_ADMIN },
  });

  if (existingSuperAdmin) {
    logger.info('Super Admin account already exists; skipping bootstrap');
    return;
  }

  const email = (process.env['SUPER_ADMIN_EMAIL'] || 'admin@chatpilot.io').toLowerCase().trim();
  const password = process.env['SUPER_ADMIN_PASSWORD'] || 'SuperAdmin_12345!Secure';

  const passwordService = new PasswordService();
  const totpService = new TotpService();

  const passwordHash = await passwordService.hash(password);
  const mfaSetup = totpService.generateSecret(email);

  const superAdmin = await prisma.user.create({
    data: {
      email,
      name: 'Platform Super Admin',
      passwordHash,
      role: Role.SUPER_ADMIN,
      platformCapable: true,
      isActive: true,
      isVerified: true,
      permissionsVersion: 1,
      totpSecret: mfaSetup.secret,
      totpRecoveryCodes: mfaSetup.hashedRecoveryCodes,
    },
  });

  logger.info(
    {
      userId: superAdmin.id,
      email: superAdmin.email,
      totpSecret: mfaSetup.secret,
      recoveryCodes: mfaSetup.recoveryCodes,
    },
    'First Super Admin bootstrapped successfully (save these recovery codes!)',
  );
}
