import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import {
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  Role,
} from '@chatpilot/contracts';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------
  // Category Management (COMPANY_ADMIN writes)
  // ----------------------------------------------------

  async createCategory(callerCtx: InteractiveAuthContext, dto: CreateMenuCategoryDto) {
    if (callerCtx.role !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException('Only Company Admin can manage menu categories');
    }

    if (!dto.name || dto.name.trim() === '') {
      throw new BadRequestException('Category name is required');
    }

    return this.prisma.menuCategory.create({
      data: {
        companyId: callerCtx.companyId!,
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? 0,
        isActive: true,
      },
    });
  }

  async listCategories(callerCtx: InteractiveAuthContext) {
    return this.prisma.menuCategory.findMany({
      where: {
        companyId: callerCtx.companyId!,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateCategory(
    callerCtx: InteractiveAuthContext,
    categoryId: string,
    dto: UpdateMenuCategoryDto,
  ) {
    if (callerCtx.role !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException('Only Company Admin can manage menu categories');
    }

    const category = await this.prisma.menuCategory.findFirst({
      where: {
        id: categoryId,
        companyId: callerCtx.companyId!,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.menuCategory.update({
      where: { id: categoryId },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async archiveCategory(callerCtx: InteractiveAuthContext, categoryId: string): Promise<void> {
    if (callerCtx.role !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException('Only Company Admin can manage menu categories');
    }

    const category = await this.prisma.menuCategory.findFirst({
      where: {
        id: categoryId,
        companyId: callerCtx.companyId!,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Soft-delete category
      await tx.menuCategory.update({
        where: { id: categoryId },
        data: { isActive: false },
      });

      // Soft-delete all child menu items
      await tx.menuItem.updateMany({
        where: { categoryId },
        data: { isActive: false },
      });
    });
  }

  // ----------------------------------------------------
  // Item Management (COMPANY_ADMIN writes)
  // ----------------------------------------------------

  async createItem(callerCtx: InteractiveAuthContext, dto: CreateMenuItemDto) {
    if (callerCtx.role !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException('Only Company Admin can manage menu items');
    }

    if (!dto.name || dto.name.trim() === '') {
      throw new BadRequestException('Item name is required');
    }

    if (dto.price === undefined || dto.price < 0) {
      throw new BadRequestException('Valid non-negative price is required');
    }

    // Verify category belongs to caller's company
    const category = await this.prisma.menuCategory.findFirst({
      where: {
        id: dto.categoryId,
        companyId: callerCtx.companyId!,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found in your company');
    }

    return this.prisma.menuItem.create({
      data: {
        companyId: callerCtx.companyId!,
        categoryId: dto.categoryId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        price: dto.price,
        imageUrl: dto.imageUrl?.trim() || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async listItems(callerCtx: InteractiveAuthContext, categoryId?: string) {
    return this.prisma.menuItem.findMany({
      where: {
        companyId: callerCtx.companyId!,
        ...(categoryId && { categoryId }),
        isActive: true,
      },
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getItem(callerCtx: InteractiveAuthContext, itemId: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: {
        id: itemId,
        companyId: callerCtx.companyId!,
      },
      include: {
        category: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    return item;
  }

  async updateItem(
    callerCtx: InteractiveAuthContext,
    itemId: string,
    dto: UpdateMenuItemDto,
  ) {
    if (callerCtx.role !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException('Only Company Admin can manage menu items');
    }

    const item = await this.prisma.menuItem.findFirst({
      where: {
        id: itemId,
        companyId: callerCtx.companyId!,
      },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    if (dto.categoryId) {
      const category = await this.prisma.menuCategory.findFirst({
        where: {
          id: dto.categoryId,
          companyId: callerCtx.companyId!,
        },
      });
      if (!category) {
        throw new NotFoundException('Category not found in your company');
      }
    }

    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description ? dto.description.trim() : null }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl ? dto.imageUrl.trim() : null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async archiveItem(callerCtx: InteractiveAuthContext, itemId: string): Promise<void> {
    if (callerCtx.role !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException('Only Company Admin can manage menu items');
    }

    const item = await this.prisma.menuItem.findFirst({
      where: {
        id: itemId,
        companyId: callerCtx.companyId!,
      },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    await this.prisma.menuItem.update({
      where: { id: itemId },
      data: { isActive: false },
    });
  }
}
