'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'ar' | 'en';
export type SupportedLocale = 'ar-EG' | 'en-US';

export type MessageKey =
  | 'workspace'
  | 'overview'
  | 'orders'
  | 'platformCompanies'
  | 'platformAnalytics'
  | 'billing'
  | 'branches'
  | 'companySettings'
  | 'staff'
  | 'menu'
  | 'knowledge'
  | 'whatsapp'
  | 'companyAnalytics'
  | 'branchAnalytics'
  | 'branchSettings'
  | 'menuAvailability'
  | 'kitchen'
  | 'delivery'
  | 'logout'
  | 'currentRole'
  | 'language'
  | 'arabic'
  | 'english'
  | 'loadingWorkspace';

const messages: Record<Language, Record<MessageKey, string>> = {
  ar: {
    workspace: 'مساحات العمل',
    overview: 'نظرة عامة',
    orders: 'الطلبات',
    platformCompanies: 'الشركات والمنصة',
    platformAnalytics: 'تحليلات المنصة',
    billing: 'الاشتراكات والاستخدام',
    branches: 'الفروع',
    companySettings: 'إعدادات الشركة',
    staff: 'فريق العمل',
    menu: 'القائمة',
    knowledge: 'قاعدة المعرفة',
    whatsapp: 'اتصال واتساب',
    companyAnalytics: 'تحليلات الشركة',
    branchAnalytics: 'تحليلات الفرع',
    branchSettings: 'إعدادات الفرع',
    menuAvailability: 'إتاحة القائمة',
    kitchen: 'لوحة المطبخ',
    delivery: 'لوحة التوصيل',
    logout: 'خروج',
    currentRole: 'الدور الحالي',
    language: 'اللغة',
    arabic: 'العربية',
    english: 'English',
    loadingWorkspace: 'جارٍ تحميل مساحة العمل...',
  },
  en: {
    workspace: 'Workspaces',
    overview: 'Overview',
    orders: 'Orders',
    platformCompanies: 'Companies & platform',
    platformAnalytics: 'Platform analytics',
    billing: 'Billing & usage',
    branches: 'Branches',
    companySettings: 'Company settings',
    staff: 'Team',
    menu: 'Menu',
    knowledge: 'Knowledge base',
    whatsapp: 'WhatsApp connection',
    companyAnalytics: 'Company analytics',
    branchAnalytics: 'Branch analytics',
    branchSettings: 'Branch settings',
    menuAvailability: 'Menu availability',
    kitchen: 'Kitchen board',
    delivery: 'Delivery board',
    logout: 'Log out',
    currentRole: 'Current role',
    language: 'Language',
    arabic: 'العربية',
    english: 'English',
    loadingWorkspace: 'Loading workspace...',
  },
};

const LANGUAGE_KEY = 'chatpilot.language';

export function languageToLocale(language: Language): SupportedLocale {
  return language === 'en' ? 'en-US' : 'ar-EG';
}

export function languageToDirection(language: Language): 'rtl' | 'ltr' {
  return language === 'en' ? 'ltr' : 'rtl';
}

export function formatDateTime(
  value: string | number | Date,
  language: Language,
  timeZone?: string,
) {
  return new Intl.DateTimeFormat(languageToLocale(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}

export function formatNumber(value: number, language: Language) {
  return new Intl.NumberFormat(languageToLocale(language)).format(value);
}

export function formatCurrency(value: number, currency: string, language: Language) {
  return new Intl.NumberFormat(languageToLocale(language), {
    style: 'currency',
    currency,
  }).format(value);
}

type I18nContextValue = {
  language: Language;
  locale: SupportedLocale;
  direction: 'rtl' | 'ltr';
  setLanguage: (language: Language) => void;
  t: (key: MessageKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar');

  useEffect(() => {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'ar' || saved === 'en') setLanguageState(saved);
  }, []);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(LANGUAGE_KEY, nextLanguage);
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      locale: languageToLocale(language),
      direction: languageToDirection(language),
      setLanguage,
      t: (key) => messages[language][key],
    }),
    [language],
  );

  useEffect(() => {
    document.documentElement.lang = value.locale;
    document.documentElement.dir = value.direction;
  }, [value.direction, value.locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within LanguageProvider');
  return context;
}
