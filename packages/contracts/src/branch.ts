export interface CreateBranchDto {
  code: string;
  name: string;
  address?: string;
  timezone?: string;
  deliveryFee?: number;
  minOrder?: number;
  operatingHours?: Record<string, unknown>;
}

export interface UpdateBranchSettingsDto {
  name?: string;
  address?: string;
  operatingHours?: Record<string, unknown>;
  deliveryFee?: number;
  minOrder?: number;
}

export interface UpdateTimezoneDto {
  timezone: string;
  reason: string;
}

export interface BranchResponseDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  address: string | null;
  timezone: string;
  isActive: boolean;
  deliveryFee: number | null;
  minOrder: number | null;
  operatingHours: unknown;
  createdAt: Date;
  updatedAt: Date;
}
