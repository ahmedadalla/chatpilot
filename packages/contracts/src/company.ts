import { CompanyStatus } from './enums';

export interface CreateCompanyDto {
  name: string;
  slug: string;
  adminEmail: string;
  countryCode?: string;
  defaultCurrency?: string;
  defaultTimezone?: string;
  defaultLocale?: string;
  defaultCallingCode?: string;
}

export interface UpdateCompanySettingsDto {
  countryCode?: string;
  defaultCurrency?: string;
  defaultTimezone?: string;
  defaultLocale?: string;
  defaultCallingCode?: string;
}

export interface CompanySettingsResponse {
  countryCode: string;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultLocale: string;
  defaultCallingCode: string;
}

export interface CompanyResponseDto {
  id: string;
  slug: string;
  name: string;
  status: CompanyStatus;
  settings?: CompanySettingsResponse;
  createdAt: Date;
  updatedAt: Date;
}

export interface SuspendCompanyDto {
  reason: string;
}
