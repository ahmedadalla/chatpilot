import { Controller, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InteractiveAuthContext } from '@chatpilot/database';
import { SocketTokenService } from './socket-token.service';

@Controller('socket')
@UseGuards(JwtAuthGuard)
export class SocketController {
  constructor(private readonly socketTokenService: SocketTokenService) {}

  @Post('token')
  createToken(@CurrentUser() user: InteractiveAuthContext) {
    if (!user.sessionId) {
      throw new UnauthorizedException('Authenticated session is required for socket connection');
    }
    return { token: this.socketTokenService.generateOneTimeToken(user.userId, user.sessionId) };
  }
}
