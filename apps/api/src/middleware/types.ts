import type { AuthUser, Session } from '../lib/auth.js';

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  status: string;
  plan: string;
  currency: string;
  timezone: string;
  taxRate: number;
  /** Resolved role of the current user inside this tenant. */
  role: 'owner' | 'admin' | 'manager' | 'staff' | null;
  locationId: string | null;
}

export interface AppEnv {
  Variables: {
    requestId: string;
    user: AuthUser | null;
    session: Session['session'] | null;
    tenant: TenantContext | null;
  };
}
