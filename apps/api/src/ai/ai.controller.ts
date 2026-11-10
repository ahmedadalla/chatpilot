import { Controller, Get, Patch, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@chatpilot/database';
import { SecretsService } from '../security/secrets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../auth/guards/capabilities.guard';
import { RequireCapabilities } from '../auth/decorators/require-caps.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InteractiveAuthContext } from '@chatpilot/database';
import { AiConfigResponseDto, UpdateAiConfigDto } from '@chatpilot/contracts';

@Controller('ai')
@UseGuards(JwtAuthGuard, CapabilitiesGuard)
export class AiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretsService: SecretsService,
  ) {}

  @Get('config')
  @RequireCapabilities('ai:config:read')
  async getConfig(@CurrentUser() user: InteractiveAuthContext): Promise<AiConfigResponseDto> {
    if (!user.companyId) {
      throw new NotFoundException('Company context required');
    }

    const config = await this.prisma.aiConfiguration.findUnique({
      where: { companyId: user.companyId },
    });

    if (!config) {
      return {
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        systemPromptTemplate: null,
        hasApiKey: false,
      };
    }

    return {
      provider: config.provider,
      model: config.model,
      systemPromptTemplate: config.systemPromptTemplate,
      hasApiKey: Boolean(config.encryptedApiKey),
    };
  }

  @Patch('config')
  @RequireCapabilities('ai:config:write')
  async updateConfig(
    @CurrentUser() user: InteractiveAuthContext,
    @Body() dto: UpdateAiConfigDto,
  ): Promise<AiConfigResponseDto> {
    if (!user.companyId) {
      throw new NotFoundException('Company context required');
    }

    let encryptedApiKey: string | undefined = undefined;
    if (dto.apiKey && dto.apiKey.trim() !== '') {
      encryptedApiKey = this.secretsService.encrypt(dto.apiKey.trim());
    }

    const updated = await this.prisma.aiConfiguration.upsert({
      where: { companyId: user.companyId },
      create: {
        companyId: user.companyId,
        provider: dto.provider || 'gemini',
        model: dto.model || 'gemini-1.5-flash',
        systemPromptTemplate: dto.systemPromptTemplate,
        encryptedApiKey,
      },
      update: {
        ...(dto.provider && { provider: dto.provider }),
        ...(dto.model && { model: dto.model }),
        ...(dto.systemPromptTemplate !== undefined && {
          systemPromptTemplate: dto.systemPromptTemplate,
        }),
        ...(encryptedApiKey && { encryptedApiKey }),
      },
    });

    return {
      provider: updated.provider,
      model: updated.model,
      systemPromptTemplate: updated.systemPromptTemplate,
      hasApiKey: Boolean(updated.encryptedApiKey),
    };
  }
}
