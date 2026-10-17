export interface CreateMenuCategoryDto {
  name: string;
  sortOrder?: number;
}

export interface UpdateMenuCategoryDto {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateMenuItemDto {
  categoryId: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export interface UpdateMenuItemDto {
  categoryId?: string;
  name?: string;
  price?: number;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export interface SetBranchAvailabilityDto {
  menuItemId: string;
  isAvailable: boolean;
  priceOverride?: number;
}

export interface ResolvedMenuItemDto {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  isAvailable: boolean;
  isOverridden: boolean;
  currency: string;
}

export interface ResolvedMenuCategoryDto {
  id: string;
  name: string;
  sortOrder: number;
  items: ResolvedMenuItemDto[];
}
