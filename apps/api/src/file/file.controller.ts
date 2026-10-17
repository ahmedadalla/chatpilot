import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileService } from './file.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InteractiveAuthContext } from '@chatpilot/database';
import { FilePurpose } from '@chatpilot/contracts';

export interface UploadFileDto {
  purpose: FilePurpose;
  filename: string;
  mimeType: string;
  dataBase64: string;
}

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  async uploadFile(
    @CurrentUser() user: InteractiveAuthContext,
    @Body() dto: UploadFileDto,
  ) {
    if (!dto.dataBase64 || !dto.filename || !dto.mimeType || !dto.purpose) {
      throw new BadRequestException('purpose, filename, mimeType, and dataBase64 are required');
    }

    const buffer = Buffer.from(dto.dataBase64, 'base64');
    return this.fileService.uploadFile(
      user,
      dto.purpose,
      buffer,
      dto.filename,
      dto.mimeType,
    );
  }

  @Get(':id/signed-url')
  async getPresignedUrl(
    @CurrentUser() user: InteractiveAuthContext,
    @Param('id') fileId: string,
  ) {
    return this.fileService.getPresignedUrl(user, fileId);
  }
}
