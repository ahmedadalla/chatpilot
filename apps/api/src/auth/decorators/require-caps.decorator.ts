import { SetMetadata } from '@nestjs/common';
import { Capability } from '@chatpilot/contracts';

export const CAPABILITIES_KEY = 'capabilities';
export const RequireCapabilities = (...capabilities: Capability[]) =>
  SetMetadata(CAPABILITIES_KEY, capabilities);
