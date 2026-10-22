/**
 * URL / slug helpers shared by signup, tenant settings and the platform console.
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
const slugify = (value) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/** A slug that is guaranteed not to collide with an existing one. */
const uniqueSlug = (base, taken) => {
  const root = slugify(base) || 'business';
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
};

const isReservedSlug = (slug) => RESERVED_SLUGS.has(String(slug || '').toLowerCase());

module.exports = { slugify, uniqueSlug, isReservedSlug, RESERVED_SLUGS };
