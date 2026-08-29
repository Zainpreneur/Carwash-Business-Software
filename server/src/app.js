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
const conciergeRoutes = require('./routes/conciergeRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const ledgerRoutes = require('./routes/ledgerRoutes');
const hrRoutes = require('./routes/hrRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const simulationRoutes = require('./routes/simulationRoutes');
const agentOpsRoutes = require('./routes/agentOpsRoutes');
const growthRoutes = require('./routes/growthRoutes');
const knowledgeBaseRoutes = require('./routes/knowledgeBaseRoutes');
const documentRoutes = require('./routes/documentRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const platformRoutes = require('./routes/platformRoutes');
const v1Routes = require('./routes/v1Routes');
const { handleStripeWebhook } = require('./controllers/stripeWebhookController');
const { verifyWebhook, receiveMessage } = require('./controllers/whatsappWebhookController');
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

// WhatsApp Cloud API webhook — wash-concierge's inbound channel. GET is Meta's one-time
// verification handshake (no body); POST needs the raw bytes for the optional
// X-Hub-Signature-256 check, same reasoning as the Stripe webhook above.
app.get('/api/webhooks/whatsapp', verifyWebhook);
app.post('/api/webhooks/whatsapp', express.raw({ type: 'application/json' }), receiveMessage);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
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
app.use('/api/concierge', conciergeRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/simulations', simulationRoutes);
app.use('/api/agent-ops', agentOpsRoutes);
app.use('/api/growth', growthRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/v1', v1Routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
