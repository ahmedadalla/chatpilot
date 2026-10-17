import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@chatpilot/database';
import {
  ResolvedMenuItemDto,
  ResolvedMenuCategoryDto,
} from '@chatpilot/contracts';

@Injectable()
export class AvailabilityResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves authoritative availability and price for a single menu item in a branch (D-1).
   * Used by AI ordering tools and OrderWorkflowService.
   */
  async resolveItem(
    companyId: string,
    branchId: string,
    menuItemId: string,
  ): Promise<ResolvedMenuItemDto> {
    // 1. Fetch branch and company currency
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, companyId },
      include: { company: { include: { settings: true } } },
    });

    if (!branch) {
      throw new NotFoundException(`Branch ${branchId} not found in company ${companyId}`);
    }

    const currency = branch.company.settings?.defaultCurrency || 'EGP';

    // 2. Fetch menu item with its category
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, companyId },
      include: { category: true },
    });

    if (!item) {
      throw new NotFoundException(`Menu item ${menuItemId} not found in company ${companyId}`);
    }

    // 3. Fetch branch availability override if exists
    const override = await this.prisma.menuItemAvailability.findUnique({
      where: {
        menuItemId_branchId: {
          menuItemId,
          branchId,
        },
      },
    });

    // 4. Resolve status: category, item, and branch must all be active
    const isBaseActive = item.isActive && item.category.isActive && branch.isActive;
    const isAvailable = override !== null ? override.isAvailable && isBaseActive : isBaseActive;

    // 5. Resolve effective price: branch priceOverride takes precedence if set
    const effectivePrice =
      override?.priceOverride !== null && override?.priceOverride !== undefined
        ? Number(override.priceOverride)
        : Number(item.price);

    return {
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      price: effectivePrice,
      isAvailable,
      isOverridden: override !== null,
      currency,
    };
  }

  /**
   * Resolves the entire active branch menu for digital menus and AI ordering.
   */
  async resolveBranchMenu(
    companyId: string,
    branchId: string,
  ): Promise<ResolvedMenuCategoryDto[]> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, companyId },
      include: { company: { include: { settings: true } } },
    });

    if (!branch || !branch.isActive) {
      throw new NotFoundException('Active branch not found');
    }

    const currency = branch.company.settings?.defaultCurrency || 'EGP';

    // Fetch active categories with active items
    const categories = await this.prisma.menuCategory.findMany({
      where: {
        companyId,
        isActive: true,
      },
      include: {
        menuItems: {
          where: { isActive: true },
          include: {
            availabilities: {
              where: { branchId },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return categories.map((cat) => {
      const items: ResolvedMenuItemDto[] = cat.menuItems.map((item) => {
        const override = item.availabilities[0] || null;
        const isAvailable = override !== null ? override.isAvailable : true;
        const effectivePrice =
          override?.priceOverride !== null && override?.priceOverride !== undefined
            ? Number(override.priceOverride)
            : Number(item.price);

        return {
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          price: effectivePrice,
          isAvailable,
          isOverridden: override !== null,
          currency,
        };
      });

      return {
        id: cat.id,
        name: cat.name,
        sortOrder: cat.sortOrder,
        items,
      };
    });
  }
}
