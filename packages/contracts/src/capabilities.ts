/**
 * Fine-grained system capabilities (domain:action[:qualifier])
 */
export type Capability =
  // Company management
  | 'company:create'
  | 'company:suspend/activate'
  | 'company:settings:write'
  | 'company:read'
  | 'company:subscribe:assign'
  | 'company:usage:read'
  // Branch management
  | 'branch:create/deactivate'
  | 'branch:settings:write'
  | 'branch:edit'
  // Menu
  | 'menu:write'
  | 'menu:read'
  | 'menu:branch-availability:write'
  // Orders
  | 'orders:read'
  | 'orders:create'
  | 'orders:transition:accept'
  | 'orders:transition:start-prep'
  | 'orders:transition:ready'
  | 'orders:transition:start-delivery'
  | 'orders:transition:complete'
  | 'orders:transition:cancel'
  | 'orders:transition:fail-delivery'
  | 'orders:audit:read'
  // Operational boards
  | 'kitchen:board'
  | 'delivery:board'
  // Staff
  | 'staff:invite'
  | 'staff:deactivate'
  | 'staff:self:read'
  // WhatsApp
  | 'whatsapp:config:write'
  | 'whatsapp:conversations:read'
  // Knowledge Base & AI
  | 'kb:write/read'
  | 'ai:config:write'
  | 'ai:config:read'
  // Analytics (Strict separation between operational and financial, D-14)
  | 'analytics:platform'
  | 'analytics:company'
  | 'analytics:operational:read'
  | 'analytics:financial:read'
  // Audit & Files
  | 'audit:read'
  | 'files:upload';

/**
 * Standard Role-to-Capabilities Definition Map
 */
export const ROLE_CAPABILITIES: Record<string, ReadonlySet<Capability>> = {
  SUPER_ADMIN: new Set<Capability>([
    'company:create',
    'company:suspend/activate',
    'company:read',
    'company:subscribe:assign',
    'company:usage:read',
    'staff:self:read',
    'whatsapp:conversations:read',
    'ai:config:read',
    'analytics:platform',
    'analytics:operational:read',
    'analytics:financial:read',
    'audit:read',
  ]),
  COMPANY_ADMIN: new Set<Capability>([
    'company:settings:write',
    'company:read',
    'company:usage:read',
    'branch:create/deactivate',
    'branch:settings:write',
    'branch:edit',
    'menu:write',
    'menu:read',
    'menu:branch-availability:write',
    'orders:read',
    'orders:create',
    'orders:transition:cancel',
    'orders:audit:read',
    'staff:invite',
    'staff:deactivate',
    'staff:self:read',
    'whatsapp:config:write',
    'whatsapp:conversations:read',
    'kb:write/read',
    'ai:config:write',
    'ai:config:read',
    'analytics:company',
    'analytics:operational:read',
    'analytics:financial:read',
    'audit:read',
    'files:upload',
  ]),
  BRANCH_MANAGER: new Set<Capability>([
    'company:read',
    'branch:settings:write',
    'branch:edit',
    'menu:read',
    'menu:branch-availability:write',
    'orders:read',
    'orders:create',
    'orders:transition:cancel',
    'orders:transition:fail-delivery',
    'orders:audit:read',
    'kitchen:board',
    'delivery:board',
    'staff:invite',
    'staff:deactivate',
    'staff:self:read',
    'whatsapp:conversations:read',
    'kb:write/read',
    'analytics:operational:read',
    'analytics:financial:read',
  ]),
  KITCHEN: new Set<Capability>([
    'company:read',
    'menu:read',
    'orders:read',
    'orders:transition:accept',
    'orders:transition:start-prep',
    'orders:transition:ready',
    'orders:audit:read',
    'kitchen:board',
    'staff:self:read',
    'analytics:operational:read',
    // financial metrics explicitly excluded
  ]),
  DELIVERY: new Set<Capability>([
    'company:read',
    'menu:read',
    'orders:read',
    'orders:transition:start-delivery',
    'orders:transition:complete',
    'orders:transition:fail-delivery',
    'orders:audit:read',
    'delivery:board',
    'staff:self:read',
    'analytics:operational:read',
    // pending rejection and financial metrics explicitly excluded
  ]),
  STAFF: new Set<Capability>([
    'company:read',
    'menu:read',
    'orders:read',
    'orders:create',
    'orders:transition:accept',
    'orders:transition:cancel', // PENDING only
    'orders:audit:read',
    'kitchen:board', // intake board view
    'staff:self:read',
    'analytics:operational:read',
    // prep/ready transitions and financial metrics explicitly excluded
  ]),
};
