import {
  Controller,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { SocketTokenService } from './socket-token.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InteractiveAuthContext } from '@chatpilot/database';

@Controller('socket')
@UseGuards(JwtAuthGuard)
export class SocketController {
  constructor(private readonly socketTokenService: SocketTokenService) {}

  @Post('ticket')
  @HttpCode(HttpStatus.OK)
  async getHandshakeTicket(@CurrentUser() user: InteractiveAuthContext) {
    if (!user.sessionId) {
      throw new BadRequestException(
        'Active authenticated session is required to issue a socket ticket',
      );
    }

    const ticket = this.socketTokenService.generateOneTimeToken(user.userId, user.sessionId);

    return { ticket };
  }
}
