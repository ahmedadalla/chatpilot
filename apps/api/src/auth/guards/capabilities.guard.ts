import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CAPABILITIES_KEY } from '../decorators/require-caps.decorator';
import { Capability } from '@chatpilot/contracts';
import { InteractiveAuthContext } from '@chatpilot/database';

@Injectable()
export class CapabilitiesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredCapabilities = this.reflector.getAllAndOverride<Capability[]>(
      CAPABILITIES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredCapabilities || requiredCapabilities.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authContext = request.authContext as InteractiveAuthContext | undefined;

    if (!authContext || !authContext.capabilities) {
      throw new ForbiddenException('Missing authorization context');
    }

    for (const cap of requiredCapabilities) {
      if (!authContext.capabilities.has(cap)) {
        throw new ForbiddenException(`Insufficient permissions: requires "${cap}"`);
      }
    }

    return true;
  }
}
