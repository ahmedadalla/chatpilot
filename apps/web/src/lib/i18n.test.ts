import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  languageToDirection,
  languageToLocale,
} from './i18n';

test('Arabic remains the default presentation direction and locale', () => {
  assert.equal(languageToDirection('ar'), 'rtl');
  assert.equal(languageToLocale('ar'), 'ar-EG');
});

test('English switches presentation direction and locale', () => {
  assert.equal(languageToDirection('en'), 'ltr');
  assert.equal(languageToLocale('en'), 'en-US');
});

test('formatters honor the selected language and currency', () => {
  assert.equal(formatNumber(1234567, 'en'), '1,234,567');
  assert.match(formatCurrency(1250.5, 'USD', 'en'), /1,250\.50/);
  assert.match(formatCurrency(1250.5, 'USD', 'ar'), /١٬٢٥٠٫٥٠/);
});

test('date formatting accepts a configured timezone', () => {
  const formatted = formatDateTime('2025-01-01T00:00:00.000Z', 'en', 'UTC');
  assert.match(formatted, /Jan 1, 2025/);
});
