import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

export interface AccessTokenPayload {
  sub: string; // userId
  sid: string; // sessionId
  jti: string; // token unique ID
  ver: number; // permissionsVersion
  iat?: number;
  exp?: number;
}

@Injectable()
export class TokenService {
  private readonly secret: string;
  private readonly ttlSeconds: number;

  constructor() {
    const secret = process.env['JWT_SECRET'];
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be set via environment and be at least 32 characters');
    }
    this.secret = secret;
    this.ttlSeconds = Number(process.env['JWT_ACCESS_TTL'] || 900);
  }

  /**
   * Issues a stateless 15-minute access JWT containing ONLY identity and session pointers.
   * Strictly NO role, companyId, branchId, or scope claims inside the JWT (AUTHORIZATION_MODEL.md §3.2).
   */
  issueAccessToken(userId: string, sessionId: string, permissionsVersion: number): string {
    const payload: AccessTokenPayload = {
      sub: userId,
      sid: sessionId,
      jti: randomUUID(),
      ver: permissionsVersion,
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.ttlSeconds,
      algorithm: 'HS256',
    });
  }

  /**
   * Verifies access JWT signature and expiry, returning the verified payload.
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
      }) as AccessTokenPayload;
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Access token expired');
      }
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
