import { Hono } from 'hono';
import type { AppEnv } from '../middleware/types.js';
import bookings from './bookings.js';
import customers from './customers.js';
import dashboard from './dashboard.js';
import hr from './hr.js';
import inventory from './inventory.js';
import membershipPlans from './membership-plans.js';
import membershipSubscriptions from './membership-subscriptions.js';
import onboarding from './onboarding.js';
import publicRoutes from './public.js';
import saas from './saas.js';
import serviceBays from './service-bays.js';
import services from './services.js';
import tenants from './tenants.js';
import tickets from './tickets.js';
import users from './users.js';
import vehicles from './vehicles.js';
import washOrders from './wash-orders.js';
import washPackages from './wash-packages.js';
import webhooks from './webhooks.js';

export const apiRoutes = new Hono<AppEnv>()
  .route('/customers', customers)
  .route('/vehicles', vehicles)
  .route('/services', services)
  .route('/bookings', bookings)
  .route('/wash-orders', washOrders)
  .route('/wash-packages', washPackages)
  .route('/service-bays', serviceBays)
  .route('/membership-plans', membershipPlans)
  .route('/membership-subscriptions', membershipSubscriptions)
  .route('/tickets', tickets)
  .route('/hr', hr)
  .route('/inventory', inventory)
  .route('/tenant', tenants)
  .route('/users', users)
  .route('/dashboard', dashboard)
  .route('/onboarding', onboarding)
  .route('/public', publicRoutes)
  .route('/saas', saas)
  .route('/webhooks', webhooks);

export default apiRoutes;
