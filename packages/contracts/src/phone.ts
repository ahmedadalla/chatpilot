import { parsePhoneNumberWithError, CountryCode } from 'libphonenumber-js';

export interface NormalizedPhoneResult {
  e164: string;
  country: CountryCode | undefined;
  isValid: boolean;
  nationalNumber: string;
}

/**
 * Normalizes and validates incoming phone numbers according to E.164.
 * Default country is Egypt (EG, +20) per Q-REQ-6, while preserving valid international numbers.
 */
export function normalizePhoneNumber(
  rawPhone: string,
  defaultCountry: CountryCode = 'EG',
): NormalizedPhoneResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new Error('Invalid phone number: input must be a non-empty string');
  }

  const trimmed = rawPhone.trim();

  try {
    const phoneNumber = parsePhoneNumberWithError(trimmed, defaultCountry);

    if (!phoneNumber.isValid()) {
      throw new Error(`Phone number ${rawPhone} is invalid for country ${defaultCountry}`);
    }

    return {
      e164: phoneNumber.format('E.164'),
      country: phoneNumber.country,
      isValid: true,
      nationalNumber: phoneNumber.nationalNumber,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown parsing error';
    throw new Error(`Failed to parse phone number "${rawPhone}": ${message}`);
  }
}
