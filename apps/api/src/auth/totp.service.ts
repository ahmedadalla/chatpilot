import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as OTPAuth from 'otpauth';
import { randomBytes, createHash } from 'node:crypto';

export interface GeneratedTotpSetup {
  secret: string;
  otpauthUri: string;
  recoveryCodes: string[];
  hashedRecoveryCodes: string[];
}

@Injectable()
export class TotpService {
  /**
   * Hashes a code/token using SHA-256 for secure constant storage
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Generates a new TOTP secret, URI for QR code, and 10 single-use recovery codes (D-19)
   */
  generateSecret(email: string, issuer = 'ChatPilot'): GeneratedTotpSetup {
    const totp = new OTPAuth.TOTP({
      issuer,
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret({ size: 20 }),
    });

    const secretBase32 = totp.secret.base32;
    const otpauthUri = totp.toString();

    // Generate 10 cryptographically secure recovery codes (e.g. "a1b2-c3d4")
    const recoveryCodes: string[] = [];
    const hashedRecoveryCodes: string[] = [];

    for (let i = 0; i < 10; i++) {
      const raw = randomBytes(5).toString('hex'); // 10 hex chars
      const formatted = `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
      recoveryCodes.push(formatted);
      hashedRecoveryCodes.push(this.hashToken(formatted));
    }

    return {
      secret: secretBase32,
      otpauthUri,
      recoveryCodes,
      hashedRecoveryCodes,
    };
  }

  /**
   * Validates a 6-digit TOTP token with +/- 1 time window drift tolerance
   */
  verifyToken(secretBase32: string, token: string): boolean {
    if (!token || token.trim().length !== 6) {
      return false;
    }

    try {
      const totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secretBase32),
      });

      // delta is non-null if token is valid within the window (delta 0 = current, -1/+1 = adjacent steps)
      const delta = totp.validate({ token: token.trim(), window: 1 });
      return delta !== null;
    } catch {
      return false;
    }
  }

  /**
   * Verifies and burns a single-use recovery code from the stored hashed recovery codes list
   */
  verifyAndBurnRecoveryCode(
    recoveryCode: string,
    storedHashedCodes: string[],
  ): { isValid: boolean; remainingHashedCodes: string[] } {
    const targetHash = this.hashToken(recoveryCode);
    const index = storedHashedCodes.indexOf(targetHash);

    if (index === -1) {
      return { isValid: false, remainingHashedCodes: storedHashedCodes };
    }

    // Burn the code by removing it from the array
    const remaining = [...storedHashedCodes];
    remaining.splice(index, 1);

    return { isValid: true, remainingHashedCodes: remaining };
  }
}
