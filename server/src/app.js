const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const washOrderRoutes = require('./routes/washOrderRoutes');
const washPackageRoutes = require('./routes/washPackageRoutes');
const serviceBayRoutes = require('./routes/serviceBayRoutes');
const membershipPlanRoutes = require('./routes/membershipPlanRoutes');
const membershipSubscriptionRoutes = require('./routes/membershipSubscriptionRoutes');
const integrationRoutes = require('./routes/integrationRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const publicBookingRoutes = require('./routes/publicBookingRoutes');
const hrRoutes = require('./routes/hrRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const platformRoutes = require('./routes/platformRoutes');
const saasRoutes = require('./routes/saasRoutes');
const { resolveTenant, resolveLocation } = require('./middleware/tenantMiddleware');
const { handleStripeWebhook } = require('./controllers/stripeWebhookController');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  })
);

// Stripe webhook needs the exact raw request bytes to verify its signature — must be
// registered before the global express.json() body parser below, and unauthenticated
// (Stripe, not a logged-in user, calls this; the signature check is the auth).
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Which business is this request about? Resolved from the X-Tenant-Slug header,
// a ?tenant= query, a custom domain, a subdomain or a /t/<slug> path prefix.
// The resolved tenant is only a candidate — `protect` verifies the caller is
// actually a member of it.
app.use('/api', resolveTenant, resolveLocation);

app.use('/api/saas', saasRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/wash-orders', washOrderRoutes);
app.use('/api/wash-packages', washPackageRoutes);
app.use('/api/service-bays', serviceBayRoutes);
app.use('/api/membership-plans', membershipPlanRoutes);
app.use('/api/membership-subscriptions', membershipSubscriptionRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/public', publicBookingRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/inventory', inventoryRoutes);

// Single-process mode: serve the built React app (server/static) from Express so the
// whole product runs as ONE node server on ONE port. Skipped when no build exists,
// which keeps the dev flow (Vite dev server) fully intact.
const path = require('path');
const fs = require('fs');
const staticDir = path.join(__dirname, '..', 'static');
if (fs.existsSync(path.join(staticDir, 'index.html'))) {
  app.use(express.static(staticDir));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(staticDir, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
