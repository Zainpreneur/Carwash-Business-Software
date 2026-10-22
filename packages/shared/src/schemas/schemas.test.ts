import { describe, expect, it } from 'vitest';
import { createCustomerSchema, createWashOrderSchema, paginationSchema } from './index.js';

describe('shared schemas', () => {
  it('accepts a minimal customer', () => {
    const parsed = createCustomerSchema.parse({ name: 'Ada', phone: '+15550100' });
    expect(parsed.whatsappOptIn).toBe(true);
    expect(parsed.isFleetAccount).toBe(false);
  });

  it('rejects an invalid phone', () => {
    expect(() => createCustomerSchema.parse({ name: 'Ada', phone: 'abc' })).toThrow();
  });

  it('coerces pagination defaults', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 20, sortDir: 'desc' });
  });

  it('requires at least one service on a wash order', () => {
    const result = createWashOrderSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
