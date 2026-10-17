import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  /**
   * Hashes a plain password using Argon2id with memory ~64MB, time 3, parallelism 1
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
  }

  /**
   * Verifies a plain password against an Argon2id hash using constant-time comparison
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Performs a dummy verification to prevent timing attacks when an account does not exist
   */
  async dummyVerify(): Promise<void> {
    // Standard precomputed dummy Argon2id hash
    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=1$c29tZXNhbHQ$7sK7G5v5Ym5p9Qx3R1w2eA';
    try {
      await argon2.verify(dummyHash, 'invalid_dummy_password');
    } catch {
      // Ignored
    }
  }
}
