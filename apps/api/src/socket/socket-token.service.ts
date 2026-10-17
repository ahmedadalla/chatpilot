import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';

interface StoredHandshakeToken {
  userId: string;
  sessionId: string;
  expiresAt: number;
}

@Injectable()
export class SocketTokenService {
  private readonly tokens = new Map<string, StoredHandshakeToken>();

  private hashToken(token: string): string {
    return createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Generates a one-time handshake token for WebSocket connection (≤60s TTL, single-use atomic consume)
   */
  generateOneTimeToken(userId: string, sessionId: string): string {
    const rawToken = randomBytes(24).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = Date.now() + 60 * 1000; // 60s TTL

    this.tokens.set(tokenHash, {
      userId,
      sessionId,
      expiresAt,
    });

    return rawToken;
  }

  /**
   * Consumes a one-time token atomically. Throws UnauthorizedException if invalid, expired, or already used.
   */
  consumeOneTimeToken(rawToken: string): { userId: string; sessionId: string } {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new UnauthorizedException('Missing handshake token');
    }

    const tokenHash = this.hashToken(rawToken);
    const record = this.tokens.get(tokenHash);

    if (!record) {
      throw new UnauthorizedException('Invalid or already consumed handshake token');
    }

    // Atomic consume (single use)
    this.tokens.delete(tokenHash);

    if (Date.now() > record.expiresAt) {
      throw new UnauthorizedException('Handshake token expired');
    }

    return {
      userId: record.userId,
      sessionId: record.sessionId,
    };
  }
}
