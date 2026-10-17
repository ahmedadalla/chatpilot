import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { KbDocumentService } from './kb-document.service';
import { KbRetrievalService } from './kb-retrieval.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { ScopeGuard } from '../auth/guards/scope.guard';
import { RequireCapabilities } from '../auth/decorators/require-caps.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InteractiveAuthContext } from '@chatpilot/database';
import {
  CreateKbDocumentDto,
  SearchKbDto,
} from '@chatpilot/contracts';

@Controller('kb')
@UseGuards(JwtAuthGuard, CapabilitiesGuard, ScopeGuard)
export class KbController {
  constructor(
    private readonly kbDocumentService: KbDocumentService,
    private readonly kbRetrievalService: KbRetrievalService,
  ) {}

  @Post('documents')
  @RequireCapabilities('kb:write/read')
  async createDocument(
    @CurrentUser() user: InteractiveAuthContext,
    @Body() dto: CreateKbDocumentDto,
  ) {
    return this.kbDocumentService.createDocument(user, dto);
  }

  @Get('documents')
  @RequireCapabilities('kb:write/read')
  async listDocuments(
    @CurrentUser() user: InteractiveAuthContext,
    @Query('branchId') branchId?: string,
  ) {
    return this.kbDocumentService.listDocuments(user, branchId);
  }

  @Get('documents/:id')
  @RequireCapabilities('kb:write/read')
  async getDocument(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') documentId: string,
  ) {
    return this.kbDocumentService.getDocument(user, documentId);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireCapabilities('kb:write/read')
  async deleteDocument(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') documentId: string,
  ) {
    await this.kbDocumentService.deleteDocument(user, documentId);
  }

  @Post('documents/:id/reprocess')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireCapabilities('kb:write/read')
  async reprocessDocument(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') documentId: string,
  ) {
    await this.kbDocumentService.reprocessDocument(user, documentId);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities('kb:write/read')
  async search(
    @CurrentUser() user: InteractiveAuthContext,
    @Body() dto: SearchKbDto,
  ) {
    return this.kbRetrievalService.search(
      user,
      dto.query,
      dto.branchId,
      dto.limit,
    );
  }
}
