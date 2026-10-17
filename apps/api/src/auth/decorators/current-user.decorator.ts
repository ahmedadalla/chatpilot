import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { InteractiveAuthContext } from '@chatpilot/database';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): InteractiveAuthContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.authContext;
  },
);
