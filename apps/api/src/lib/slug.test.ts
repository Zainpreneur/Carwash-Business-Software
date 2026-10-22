import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from './slug.js';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify("Bob's Car Wash")).toBe('bobs-car-wash');
  });

  it('strips accents', () => {
    expect(slugify('Élite Wash')).toBe('elite-wash');
  });

  it('returns an empty slug when nothing usable remains', () => {
    expect(slugify('🚗')).toBe('');
  });
});

describe('uniqueSlug', () => {
  it('uses the base slug when it is free', () => {
    expect(uniqueSlug('Acme', new Set())).toBe('acme');
  });

  it('increments past collisions', () => {
    expect(uniqueSlug('Acme', new Set(['acme', 'acme-2']))).toBe('acme-3');
  });

  it('avoids reserved platform routes', () => {
    expect(uniqueSlug('app', new Set())).toBe('app-2');
  });

  it('falls back for names with no ascii characters', () => {
    expect(uniqueSlug('!!!', new Set())).toBe('business');
  });
});
