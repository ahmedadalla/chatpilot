import assert from 'node:assert';
import test from 'node:test';
import { normalizePhoneNumber } from './phone';

test('normalizePhoneNumber - Egypt local number with +20 default', () => {
  const result = normalizePhoneNumber('01012345678');
  assert.strictEqual(result.e164, '+201012345678');
  assert.strictEqual(result.country, 'EG');
  assert.strictEqual(result.isValid, true);
});

test('normalizePhoneNumber - Egypt number with explicit +20', () => {
  const result = normalizePhoneNumber('+20 11 2345 6789');
  assert.strictEqual(result.e164, '+201123456789');
  assert.strictEqual(result.country, 'EG');
  assert.strictEqual(result.isValid, true);
});

test('normalizePhoneNumber - International number (Saudi Arabia)', () => {
  const result = normalizePhoneNumber('+966 50 123 4567');
  assert.strictEqual(result.e164, '+966501234567');
  assert.strictEqual(result.country, 'SA');
  assert.strictEqual(result.isValid, true);
});

test('normalizePhoneNumber - Invalid number fails closed', () => {
  assert.throws(() => {
    normalizePhoneNumber('12345');
  });
});
