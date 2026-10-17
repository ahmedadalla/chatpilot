export class InvalidTenantContextException extends Error {
  constructor(message: string) {
    super(`[Security Breach / Scope Invariant Violation] ${message}`);
    this.name = 'InvalidTenantContextException';
  }
}
