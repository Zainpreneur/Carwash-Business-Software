import { membershipSubscriptions } from '@carwash/db/schema';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { env } from '../env.js';
import { platformDb } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import type { AppEnv } from '../middleware/types.js';

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

const router = new Hono<AppEnv>()

  /**
   * Stripe webhook. The signature is verified against the raw request body, so this
   * route must be mounted BEFORE any JSON body middleware touches the request.
   *
   * Handled events:
   *   invoice.payment_failed -> past-due (then suspended/cancelled by a scheduled job)
   *   invoice.paid           -> active
   *   customer.subscription.deleted -> cancelled
   */
  .post('/stripe', async (c) => {
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
      logger.warn('Stripe webhook received but Stripe is not configured');
      return c.json({ received: true, ignored: true });
    }

    const signature = c.req.header('stripe-signature');
    if (!signature)
      return c.json({ error: { code: 'bad_request', message: 'Missing signature' } }, 400);

    const payload = await c.req.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.warn({ err }, 'Stripe signature verification failed');
      return c.json({ error: { code: 'invalid_signature', message: 'Bad signature' } }, 400);
    }

    const subscriptionId =
      event.type === 'customer.subscription.deleted'
        ? (event.data.object as Stripe.Subscription).id
        : ((event.data.object as { subscription?: string }).subscription ?? null);

    if (subscriptionId) {
      const status =
        event.type === 'invoice.payment_failed'
          ? 'past-due'
          : event.type === 'customer.subscription.deleted'
            ? 'cancelled'
            : event.type === 'invoice.paid'
              ? 'active'
              : null;

      if (status) {
        await platformDb
          .update(membershipSubscriptions)
          .set({ status, updatedAt: new Date() })
          .where(eq(membershipSubscriptions.stripeSubscriptionId, subscriptionId));
      }
    }

    return c.json({ received: true });
  });
export default router;
