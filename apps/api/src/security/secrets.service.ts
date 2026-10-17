import { Injectable } from '@nestjs/common';
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from 'node:crypto';

interface EncryptedEnvelope {
  v: number;
  edk: string; // Wrapped Data Encryption Key (base64)
  iv: string; // 12-byte IV for payload (base64)
  tag: string; // 16-byte GCM auth tag for payload (base64)
  data: string; // Encrypted ciphertext (base64)
}

@Injectable()
export class SecretsService {
  private readonly masterKey: Buffer;

  constructor() {
    const rawMaster = process.env['KMS_MASTER_KEY'] || 'local_dev_kms_master_key_32_bytes_min==';
    // Ensure 32-byte master key using sha256
    this.masterKey = createHash('sha256').update(rawMaster).digest();
  }

  /**
   * Encrypts plaintext using AES-256-GCM envelope encryption (D-13).
   * A unique 256-bit data key (DEK) is generated per record and wrapped with the master key.
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return '';
    }

    // 1. Generate per-record Data Encryption Key (DEK) and IVs
    const dek = randomBytes(32);
    const payloadIv = randomBytes(12);

    // 2. Encrypt plaintext with DEK
    const cipher = createCipheriv('aes-256-gcm', dek, payloadIv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    const payloadTag = cipher.getAuthTag();

    // 3. Wrap DEK with Master Key using AES-256-GCM
    const masterIv = randomBytes(12);
    const masterCipher = createCipheriv('aes-256-gcm', this.masterKey, masterIv);
    let wrappedDek = masterCipher.update(dek.toString('base64'), 'utf8', 'base64');
    wrappedDek += masterCipher.final('base64');
    const masterTag = masterCipher.getAuthTag();

    const envelope: EncryptedEnvelope = {
      v: 1,
      edk: JSON.stringify({
        iv: masterIv.toString('base64'),
        tag: masterTag.toString('base64'),
        key: wrappedDek,
      }),
      iv: payloadIv.toString('base64'),
      tag: payloadTag.toString('base64'),
      data: ciphertext,
    };

    return JSON.stringify(envelope);
  }

  /**
   * Decrypts an envelope payload back to plaintext.
   */
  decrypt(envelopeJson: string): string {
    if (!envelopeJson) {
      return '';
    }

    try {
      const envelope: EncryptedEnvelope = JSON.parse(envelopeJson);
      if (envelope.v !== 1) {
        throw new Error('Unsupported envelope version');
      }

      // 1. Unwrap DEK using Master Key
      const edkObj = JSON.parse(envelope.edk);
      const masterIv = Buffer.from(edkObj.iv, 'base64');
      const masterTag = Buffer.from(edkObj.tag, 'base64');
      const masterDecipher = createDecipheriv('aes-256-gcm', this.masterKey, masterIv);
      masterDecipher.setAuthTag(masterTag);
      let dekBase64 = masterDecipher.update(edkObj.key, 'base64', 'utf8');
      dekBase64 += masterDecipher.final('utf8');
      const dek = Buffer.from(dekBase64, 'base64');

      // 2. Decrypt payload with DEK
      const payloadIv = Buffer.from(envelope.iv, 'base64');
      const payloadTag = Buffer.from(envelope.tag, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', dek, payloadIv);
      decipher.setAuthTag(payloadTag);
      let plaintext = decipher.update(envelope.data, 'base64', 'utf8');
      plaintext += decipher.final('utf8');

      return plaintext;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Decryption error';
      throw new Error(`Failed to decrypt envelope: ${message}`);
    }
  }
}
