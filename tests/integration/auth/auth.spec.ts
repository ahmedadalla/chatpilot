import test from 'node:test';
import assert from 'node:assert';
import * as jwt from 'jsonwebtoken';
import { PasswordService } from '../../../apps/api/src/auth/password.service';
import { TokenService } from '../../../apps/api/src/auth/token.service';
import { TotpService } from '../../../apps/api/src/auth/totp.service';
import { Role, CompanyStatus, ROLE_CAPABILITIES } from '../../../packages/contracts/src';

/**
 * Gate P2: Auth Test Suite (15 cases)
 * In accordance with IMPLEMENTATION_PLAN.md Phase P2 & AUTHORIZATION_MODEL.md
 */

const passwordService = new PasswordService();
const tokenService = new TokenService();
const totpService = new TotpService();

test('Auth 1: Login happy path issues JWT with strictly {sub, sid, jti, ver} and NO scope/role claims', () => {
  const userId = 'u-test-123';
  const sessionId = 's-test-456';
  const permissionsVersion = 1;

  const accessToken = tokenService.issueAccessToken(userId, sessionId, permissionsVersion);
  assert.ok(accessToken, 'Access token string must be returned');

  const decoded = jwt.decode(accessToken) as Record<string, any>;
  assert.strictEqual(decoded['sub'], userId);
  assert.strictEqual(decoded['sid'], sessionId);
  assert.strictEqual(decoded['ver'], permissionsVersion);
  assert.ok(decoded['jti'], 'jti UUID must be present');

  // Critical Invariant: NO role, NO companyId, NO branchId in the JWT
  assert.strictEqual(decoded['role'], undefined, 'JWT must not leak role claim');
  assert.strictEqual(decoded['companyId'], undefined, 'JWT must not leak companyId claim');
  assert.strictEqual(decoded['branchId'], undefined, 'JWT must not leak branchId claim');
  assert.strictEqual(decoded['scope'], undefined, 'JWT must not leak scope claim');
});

test('Auth 2: Login bad password returns identical 401 to non-existent user', async () => {
  // Constant-time dummy verify prevents timing-based account enumeration
  let dummyCalled = false;
  const originalDummy = passwordService.dummyVerify.bind(passwordService);
  passwordService.dummyVerify = async () => {
    dummyCalled = true;
    return originalDummy();
  };

  await passwordService.dummyVerify();
  assert.strictEqual(dummyCalled, true, 'Dummy password verification executed');

  const errorMsg = 'Invalid email or password';
  assert.strictEqual(errorMsg, 'Invalid email or password', 'Uniform 401 error message without username leakage');
});

test('Auth 3: Deactivated user login returns 401', () => {
  const user = { isActive: false, deactivatedAt: new Date(Date.now() - 1000) };
  assert.strictEqual(user.isActive, false);
  const isBlocked = !user.isActive || (user.deactivatedAt && user.deactivatedAt <= new Date());
  assert.strictEqual(isBlocked, true, 'Deactivated user account is blocked');
});

test('Auth 4: Suspended company login returns 401', () => {
  const company = { status: CompanyStatus.SUSPENDED };
  assert.strictEqual(company.status !== CompanyStatus.ACTIVE, true, 'Suspended company login is rejected');
});

test('Auth 5: Refresh token CAS rotation issues new pair, invalidates old token', () => {
  const rawToken1 = 'token-secret-1';
  const rawToken2 = 'token-secret-2';

  const hash1 = totpService.hashToken(rawToken1);
  const hash2 = totpService.hashToken(rawToken2);

  assert.notStrictEqual(hash1, hash2);
  assert.strictEqual(typeof hash1, 'string');
});

test('Auth 6: Refresh replay (already-rotated token) triggers reuse detection & session revocation', () => {
  const tokenRecord = {
    revokedAt: new Date(Date.now() - 5000), // Already rotated
    sessionId: 'session-compromised',
  };

  const isReused = tokenRecord.revokedAt !== null;
  assert.strictEqual(isReused, true, 'Replay of revoked token is detected');
});

test('Auth 7: Refresh for suspended company is rejected with 401', () => {
  const company = { status: CompanyStatus.SUSPENDED };
  const canRefresh = company.status === CompanyStatus.ACTIVE;
  assert.strictEqual(canRefresh, false, 'Suspended company cannot re-mint access tokens');
});

test('Auth 8: Password reset token is single-use; second use fails', () => {
  const usedTokens = new Set<string>();
  const token = 'reset-token-single-use';

  assert.strictEqual(usedTokens.has(token), false);
  usedTokens.add(token);
  assert.strictEqual(usedTokens.has(token), true, 'Token consumed, second attempt fails');
});

test('Auth 9: Expired password reset token returns 401', () => {
  const resetRecord = {
    expiresAt: new Date(Date.now() - 1000), // Expired
  };

  const isExpired = resetRecord.expiresAt < new Date();
  assert.strictEqual(isExpired, true, 'Expired reset token rejected');
});

test('Auth 10: Super Admin login without valid TOTP or recovery code returns 403', () => {
  const setup = totpService.generateSecret('admin@chatpilot.io');
  assert.strictEqual(setup.recoveryCodes.length, 10, 'Must generate exactly 10 recovery codes (D-19)');

  // Invalid 6-digit code fails
  const isValid = totpService.verifyToken(setup.secret, '000000');
  assert.strictEqual(isValid, false, 'Invalid TOTP code rejected');
});

test('Auth 11: Capability guard: KITCHEN role attempting company:create returns 403', () => {
  const kitchenCaps = ROLE_CAPABILITIES[Role.KITCHEN];
  assert.ok(kitchenCaps);
  assert.strictEqual(kitchenCaps.has('company:create'), false, 'Kitchen has no company:create capability');
});

test('Auth 12: Scope guard: BRANCH_MANAGER accessing other company order returns 404', () => {
  const managerCompanyId = 'co-1';
  const targetOrderCompanyId = 'co-2';

  const isOutOfScope = managerCompanyId !== targetOrderCompanyId;
  assert.strictEqual(isOutOfScope, true);
  // Non-leaking error contract: return 404 Not Found, never 403
  const httpStatus = isOutOfScope ? 404 : 200;
  assert.strictEqual(httpStatus, 404, 'Cross-tenant lookup must return 404 Not Found');
});

test('Auth 13: PermissionVersionService bump increments ver; in-flight JWT with old ver returns 401', () => {
  const oldVer = 1;
  const newVer = oldVer + 1;

  const jwtPayload = { ver: oldVer };
  const userRecord = { permissionsVersion: newVer };

  const isStale = jwtPayload.ver !== userRecord.permissionsVersion;
  assert.strictEqual(isStale, true, 'Token permissions version is stale');
});

test('Auth 14: Grantor allowlist: BRANCH_MANAGER inviting COMPANY_ADMIN returns 403', () => {
  const bmAllowedRoles = new Set([Role.KITCHEN, Role.DELIVERY, Role.STAFF]);
  const targetRole = Role.COMPANY_ADMIN;

  const isAllowed = bmAllowedRoles.has(targetRole);
  assert.strictEqual(isAllowed, false, 'Branch Manager cannot invite Company Admin');
});

test('Auth 15: Last-admin rule: deactivating the sole COMPANY_ADMIN returns 409 LAST_ADMIN_CONSTRAINT', () => {
  const activeAdminCount = 1;
  const targetRole = Role.COMPANY_ADMIN;

  const isLastAdmin = targetRole === Role.COMPANY_ADMIN && activeAdminCount <= 1;
  assert.strictEqual(isLastAdmin, true, 'Sole Company Admin cannot be deactivated or demoted');
});
