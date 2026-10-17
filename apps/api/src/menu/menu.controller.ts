import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { BranchAvailabilityService } from './branch-availability.service';
import { AvailabilityResolutionService } from './availability-resolution.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { ScopeGuard } from '../auth/guards/scope.guard';
import { RequireCapabilities } from '../auth/decorators/require-caps.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InteractiveAuthContext } from '@chatpilot/database';
import {
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  SetBranchAvailabilityDto,
} from '@chatpilot/contracts';

@Controller('menu')
@UseGuards(JwtAuthGuard, CapabilitiesGuard, ScopeGuard)
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly branchAvailabilityService: BranchAvailabilityService,
    private readonly availabilityResolutionService: AvailabilityResolutionService,
  ) {}

  // ----------------------------------------------------
  // Categories
  // ----------------------------------------------------

  @Post('categories')
  @RequireCapabilities('menu:write')
  async createCategory(
    @CurrentUser() user: InteractiveAuthContext,
    @Body() dto: CreateMenuCategoryDto,
  ) {
    return this.menuService.createCategory(user, dto);
  }

  @Get('categories')
  @RequireCapabilities('menu:read')
  async listCategories(@CurrentUser() user: InteractiveAuthContext) {
    return this.menuService.listCategories(user);
  }

  @Patch('categories/:id')
  @RequireCapabilities('menu:write')
  async updateCategory(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') categoryId: string,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    return this.menuService.updateCategory(user, categoryId, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireCapabilities('menu:write')
  async archiveCategory(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') categoryId: string,
  ) {
    await this.menuService.archiveCategory(user, categoryId);
  }

  // ----------------------------------------------------
  // Items
  // ----------------------------------------------------

  @Post('items')
  @RequireCapabilities('menu:write')
  async createItem(
    @CurrentUser() user: InteractiveAuthContext,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.menuService.createItem(user, dto);
  }

  @Get('items')
  @RequireCapabilities('menu:read')
  async listItems(
    @CurrentUser() user: InteractiveAuthContext,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.menuService.listItems(user, categoryId);
  }

  @Get('items/:id')
  @RequireCapabilities('menu:read')
  async getItem(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') itemId: string,
  ) {
    return this.menuService.getItem(user, itemId);
  }

  @Patch('items/:id')
  @RequireCapabilities('menu:write')
  async updateItem(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') itemId: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuService.updateItem(user, itemId, dto);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireCapabilities('menu:write')
  async archiveItem(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') itemId: string,
  ) {
    await this.menuService.archiveItem(user, itemId);
  }

  // ----------------------------------------------------
  // Branch Availability Overrides
  // ----------------------------------------------------

  @Put('branches/:branchId/availability')
  @RequireCapabilities('menu:branch-availability:write')
  async setBranchAvailability(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('branchId') branchId: string,
    @Body() dto: SetBranchAvailabilityDto,
  ) {
    return this.branchAvailabilityService.setAvailability(user, branchId, dto);
  }

  @Get('branches/:branchId/availability')
  @RequireCapabilities('menu:read')
  async listBranchAvailability(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('branchId') branchId: string,
  ) {
    return this.branchAvailabilityService.listBranchAvailability(user, branchId);
  }

  // ----------------------------------------------------
  // Authoritative Resolution
  // ----------------------------------------------------

  @Get('branches/:branchId/resolved')
  @RequireCapabilities('menu:read')
  async resolveBranchMenu(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('branchId') branchId: string,
  ) {
    return this.availabilityResolutionService.resolveBranchMenu(user.companyId!, branchId);
  }

  @Get('branches/:branchId/items/:itemId/resolved')
  @RequireCapabilities('menu:read')
  async resolveItem(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('branchId') branchId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.availabilityResolutionService.resolveItem(user.companyId!, branchId, itemId);
  }
}
