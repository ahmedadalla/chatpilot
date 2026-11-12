import pino from 'pino';
import { PrismaClient } from '@chatpilot/database';
import { PasswordService } from '../auth/password.service';
import { TotpService } from '../auth/totp.service';

const logger = pino({ name: 'bootstrap-super-admin' });

export async function bootstrapSuperAdmin(prisma: PrismaClient): Promise<void> {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const bootstrapOverride = process.env['BOOTSTRAP_OVERRIDE'] === 'true';
  const forceReset = process.env['FORCE_RESET_SUPERADMIN'] === 'true';

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
  const hashedCodesJson = JSON.stringify(mfaSetup.hashedRecoveryCodes);

  logger.info({ hasEmail: !!email }, 'Starting bootstrap');

  // ALL work inside one transaction — GUCs are transaction-local.
  const result = await prisma.$transaction(async (tx) => {
    // ── Establish preauth scope (no values — safe literal) ───────────────────
    await tx.$executeRaw`SELECT app_set_scope('preauth', NULL, NULL, NULL::uuid)`;

    // ── Check if user already exists ────────────────────────────────────────
    let existingRows: { id: string }[] = [];
    try {
      existingRows = await tx.$queryRaw<{ id: string }[]>`
        SELECT * FROM platform_find_super_admin(${email})
      `;
    } catch (err) {
      // Function not yet deployed; fall through to direct lookup below
      logger.warn({ err }, 'platform_find_super_admin not available, using fallback');
    }

    if (existingRows.length > 0) {
      const existingUser: { id: string } = existingRows[0]!;
      if (!forceReset) {
        logger.info('Super Admin account already exists; skipping bootstrap.');
        return null;
      }
      logger.warn('FORCE_RESET_SUPERADMIN=true — regenerating Super Admin credentials');
      // Detach sessions (owner-only table policy bypasses RLS)
      await tx.authSession.deleteMany({ where: { userId: existingUser.id } }).catch(() => {});
      const stillExists = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM users WHERE id = ${existingUser.id}::uuid AND role = 'SUPER_ADMIN' LIMIT 1
      `;
      if (stillExists.length > 0) {
        await tx.user.delete({ where: { id: existingUser.id } }).catch(() => {});
        logger.info(`Deleted existing Super Admin (${existingUser.id})`);
      } else {
        logger.info(`Super Admin (${existingUser.id}) already gone; proceeding with recreation`);
      }
    }

    // ── Check whether migration-005 security-definer helper exists ───────────
    let hasCreateFn = false;
    try {
      await tx.$queryRaw`SELECT 1 FROM pg_proc WHERE proname = 'superadmin_create_user' LIMIT 1`;
      hasCreateFn = true;
    } catch {
      /* function not deployed yet — will fall back below */
    }
    logger.info({ hasCreateFn }, 'Bootstrap helper function availability check');

    let createdUserId: string | null = null;
    if (hasCreateFn) {
      // SECURITY DEFINER function runs as table owner → bypasses RLS completely.
      // Pass values via parameterized $queryRaw so '$' chars never enter SQL string.
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT superadmin_create_user(
          ${email},
          'Platform Super Admin',
          ${passwordHash},
          ${mfaSetup.secret},
          ${hashedCodesJson}::jsonb
        ) AS id
      `;
      createdUserId = rows[0]?.id ?? null;
    } else {
      // No migration-005 on this DB — use direct INSERT via template tag.
      // Prisma binds $1..$N parameters natively; '$' in values is handled safely.
      const rows = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO users (
          email, name, "passwordHash", role,
          "platformCapable", "isActive", "isVerified",
          "permissionsVersion", "totpSecret", "totpRecoveryCodes",
          "createdAt", "updatedAt"
        ) VALUES (
          ${email},
          'Platform Super Admin',
          ${passwordHash},
          'SUPER_ADMIN',
          true, true, true,
          1,
          ${mfaSetup.secret},
          ${hashedCodesJson}::jsonb,
          NOW(), NOW()
        )
        RETURNING id
      `;
      createdUserId = rows[0]?.id ?? null;
    }

    return createdUserId;
  }, { timeout: 30000 });

  if (!forceReset && result === null) {
    return;
  }

  if (!result) {
    throw new Error('Failed to find or create super admin user. Check logs for details.');
  }

  const userId = result;
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🎉 Super Admin Bootstrapped Successfully');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`  User ID : ${userId}`);
  console.log(`  Email   : ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  TOTP Secret : ${mfaSetup.secret}`);
  console.log(`  OTPAuth URI : ${mfaSetup.otpauthUri}\n`);
  console.log('  🔑 Recovery Codes (save these securely!)');
  console.log('  ────────────────────────────────────────');
  mfaSetup.recoveryCodes.forEach((code, i) => {
    console.log(`    ${String(i + 1).padStart(2)}. ${code}`);
  });
  console.log('  ────────────────────────────────────────\n');
  console.log('  ⚠️  Store these codes somewhere safe. They cannot be recovered later.');
  console.log('═══════════════════════════════════════════════════════════\n');
  logger.info({ userId, email }, 'Super Admin bootstrapped successfully');
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
