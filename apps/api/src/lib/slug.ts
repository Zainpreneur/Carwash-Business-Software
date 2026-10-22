/**
 * URL-safe tenant slugs. Kept on the API side because slugs are derived from
 * user input at provisioning time; the web app only ever reads them.
 */

const RESERVED_SLUGS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'platform',
  'login',
  'signup',
  'logout',
  'settings',
  'dashboard',
  'static',
  'assets',
  'help',
  'support',
  'about',
  'pricing',
  'public',
  't',
  'demo',
  'saas',
]);

/** Lowercase, hyphenated, ASCII-safe version of a business name. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** A slug that will not collide with an existing tenant or a reserved route. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = slugify(base) || 'business';
  const isUsed = (candidate: string) => taken.has(candidate) || RESERVED_SLUGS.has(candidate);

  if (!isUsed(root)) return root;
  let n = 2;
  while (isUsed(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}
