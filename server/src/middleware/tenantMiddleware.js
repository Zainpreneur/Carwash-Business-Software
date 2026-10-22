const asyncHandler = require('express-async-handler');
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { tenants, tenantDomains } = require('../db/schema');

/**
 * Tenant resolution.
 *
 * A request can point at a business (tenant) in four ways, checked in this order:
 *
 *   1. `X-Tenant-Slug` header  — what the React client sends.
 *   2. `?tenant=<slug>` query string or a `tenantSlug` body field.
 *   3. A custom domain registered for the tenant (wash.example.com).
 *   4. A subdomain of the SaaS domain (acme.carwash.app -> `acme`).
 *   5. A `/t/<slug>` path prefix.
 *
 * The resolved tenant is only a *candidate*: `protect` still checks that the
 * logged-in user is actually a member of it, so a spoofed header gains nothing.
 */

// Host labels that are part of the platform itself and never a tenant slug.
const RESERVED_HOST_LABELS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'platform',
  'static',
  'assets',
  'cdn',
  'localhost',
]);

/** `acme.carwash.app` -> `acme`; `localhost` -> null. */
const slugFromHostname = (hostname) => {
  if (!hostname) return null;
  const host = String(hostname).split(':')[0].toLowerCase();
  if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  const labels = host.split('.');
  if (labels.length < 3) return null;
  const label = labels[0];
  if (RESERVED_HOST_LABELS.has(label)) return null;
  return label;
};

/** `/t/acme/...` -> `acme` */
const slugFromPath = (path) => {
  const match = /^\/t\/([a-z0-9-]+)/i.exec(String(path || ''));
  return match ? match[1].toLowerCase() : null;
};

const findTenantBySlug = async (slug) => {
  if (!slug) return null;
  const [row] = await db.select().from(tenants).where(eq(tenants.slug, String(slug).toLowerCase()));
  return row || null;
};

const findTenantByDomain = async (host) => {
  if (!host) return null;
  const [mapping] = await db.select().from(tenantDomains).where(eq(tenantDomains.domain, host));
  if (!mapping) return null;
  const [tenant] = await db.select().from(tenants).where(eq(tenants._id, mapping.tenant));
  return tenant || null;
};

/**
 * Attach `req.tenant` (the candidate tenant, may be null) and `req.tenantSlug`.
 * Never rejects — an unknown tenant simply leaves `req.tenant` null so that
 * login/signup endpoints keep working on the shared domain.
 */
const resolveTenant = asyncHandler(async (req, res, next) => {
  const host = String(req.hostname || '').split(':')[0].toLowerCase();

  let tenant = await findTenantByDomain(host);

  // An *explicit* request names the business: header, query string, body or
  // the `/t/<slug>` path prefix.
  const explicit =
    req.headers['x-tenant-slug'] ||
    req.query?.tenant ||
    req.query?.tenantSlug ||
    (req.body && (req.body.tenantSlug || req.body.tenant)) ||
    slugFromPath(req.originalUrl || req.path) ||
    null;

  if (!tenant) {
    const requested = explicit || slugFromHostname(host);
    tenant = await findTenantBySlug(requested);

    // Remember an explicit request that could not be resolved, so `protect`
    // can answer 404 instead of silently falling back to another business.
    if (!tenant && explicit) {
      req.tenantRequested = String(explicit).toLowerCase();
    }
  }

  req.tenant = tenant;
  req.tenantSlug = tenant?.slug || null;
  next();
});

/**
 * The location (site) this request is focused on, when the client asks for one.
 * `null` means "all locations of the business".
 */
const resolveLocation = asyncHandler(async (req, res, next) => {
  const raw =
    req.headers['x-location-id'] || req.query?.locationId || req.query?.location || req.body?.locationId;
  req.requestedLocationId = raw ? String(raw) : null;
  next();
});

module.exports = { resolveTenant, resolveLocation, slugFromHostname, slugFromPath };
