import type { AppType } from '@carwash/api/app';
import { hc } from 'hono/client';

const API_URL = import.meta.env.VITE_API_URL ?? '';

/** Tenant slug for the active business (set at login or from the URL). */
export function getTenantSlug(): string | null {
  return localStorage.getItem('tenantSlug');
}

export function setTenantSlug(slug: string | null): void {
  if (slug) localStorage.setItem('tenantSlug', slug);
  else localStorage.removeItem('tenantSlug');
}

/**
 * Type-safe Hono RPC client. Every path, param, request body and response type is
 * inferred from the API's route definitions — no codegen, no duplicated types.
 */
const fetchWithCredentials: typeof fetch = (input, init) =>
  fetch(input, { ...init, credentials: 'include' });

export const api = hc<AppType>(API_URL || '/', {
  // Same-origin cookies for Better Auth sessions.
  fetch: fetchWithCredentials,
  headers: () => {
    const slug = getTenantSlug();
    const headers: Record<string, string> = {};
    if (slug) headers['X-Tenant-Slug'] = slug;
    return headers;
  },
});
