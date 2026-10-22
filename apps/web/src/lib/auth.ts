import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, setTenantSlug } from './api';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  platformRole: 'user' | 'platform_admin';
  image?: string | null;
}

interface SessionResponse {
  user: SessionUser;
  session: { id: string; expiresAt: string };
}

export interface TenantMembership {
  _id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string;
  status: string;
  plan: string;
  role: string;
  scopeAllLocations: boolean;
  locationId: string | null;
}

const BASE = import.meta.env.VITE_API_URL ?? '';

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string };
    message?: string;
  } | null;
  return body?.error?.message ?? body?.message ?? `${fallback} (${res.status})`;
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api/auth${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Auth request failed'));
  }
  return (await res.json()) as T;
}

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/auth/get-session`, { credentials: 'include' });
      if (!res.ok) return null;
      const data = (await res.json()) as SessionResponse | null;
      return data?.user ? data : null;
    },
    staleTime: 60_000,
  });
}

/** All businesses the signed-in user belongs to. */
export function useMyTenants() {
  return useQuery({
    queryKey: ['my-tenants'],
    queryFn: async (): Promise<TenantMembership[]> => {
      const res = await api.api.users.me.tenants.$get();
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to load businesses'));
      const body = (await res.json()) as { data: TenantMembership[] };
      return body.data;
    },
    staleTime: 60_000,
  });
}

/** Create a business for the signed-in user, with starter data. */
export function useOnboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { businessName: string }) => {
      const res = await api.api.onboarding.$post({
        json: {
          businessName: input.businessName,
          currency: 'USD',
          timezone: 'Asia/Riyadh',
        },
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Could not create business'));
      const body = (await res.json()) as {
        data: { tenant: { slug: string; name: string }; locationId: string };
      };
      return body.data;
    },
    onSuccess: (data) => {
      setTenantSlug(data.tenant.slug);
      qc.invalidateQueries({ queryKey: ['my-tenants'] });
      qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      authFetch('/sign-in/email', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session'] }),
  });
}

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      authFetch('/sign-up/email', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session'] }),
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authFetch('/sign-out', { method: 'POST' }),
    onSuccess: () => {
      setTenantSlug(null);
      qc.clear();
    },
  });
}
