/**
 * Shared UI constants & RTL layout helpers
 */
export const RTL_LOCALES = new Set(['ar', 'ar-EG', 'ar-SA']);

export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.has(locale);
}
