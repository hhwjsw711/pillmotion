import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { ActionCtx, httpAction } from "@cvx/_generated/server";
import { ERRORS } from "~/errors";
import { stripe } from "@cvx/stripe";
import { streamChat } from "@cvx/chat";
import { STRIPE_WEBHOOK_SECRET } from "@cvx/env";
import { z } from "zod";
import { internal } from "@cvx/_generated/api";
import { Currency, Interval, PLANS } from "@cvx/schema";
import {
  sendSubscriptionErrorEmail,
  sendSubscriptionSuccessEmail,
} from "@cvx/email/templates/subscriptionEmail";
import Stripe from "stripe";
import { Doc } from "@cvx/_generated/dataModel";
import {
  STRIPE_SMALL_CREDIT_PACK,
  STRIPE_MEDIUM_CREDIT_PACK,
  STRIPE_LARGE_CREDIT_PACK,
} from "@cvx/env";

const http = httpRouter();

/**
 * Gets and constructs a Stripe event signature.
 *
 * @throws An error if Stripe signature is missing or if event construction fails.
 * @returns The Stripe event object.
 */
async function getStripeEvent(request: Request) {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error(`Stripe - ${ERRORS.ENVS_NOT_INITIALIZED}`);
  }

  try {
    const signature = request.headers.get("Stripe-Signature");
    if (!signature) throw new Error(ERRORS.STRIPE_MISSING_SIGNATURE);
    const payload = await request.text();
    const event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
    return event;
  } catch (err: unknown) {
    console.log(err);
    throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
  }
}

const handleUpdateSubscription = async (
  ctx: ActionCtx,
  user: Doc<"users">,
  subscription: Stripe.Subscription,
) => {
  const subscriptionItem = subscription.items.data[0];
  await ctx.runMutation(internal.stripe.PREAUTH_replaceSubscription, {
    userId: user._id,
    subscriptionStripeId: subscription.id,
    input: {
      currency: subscription.items.data[0].price.currency as Currency,
      planStripeId: subscriptionItem.plan.product as string,
      priceStripeId: subscriptionItem.price.id,
      interval: subscriptionItem.plan.interval as Interval,
      status: subscription.status,
      currentPeriodStart: subscriptionItem.current_period_start,
      currentPeriodEnd: subscriptionItem.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
};

const handleCheckoutSessionCompleted = async (
  ctx: ActionCtx,
  event: Stripe.CheckoutSessionCompletedEvent,
) => {
  const session = event.data.object;

  if (session.mode === "subscription" && session.subscription) {
    const { customer: customerId, subscription: subscriptionId } = z
      .object({ customer: z.string(), subscription: z.string() })
      .parse(session);

    const user = await ctx.runQuery(
      internal.stripe.PREAUTH_getUserByCustomerId,
      {
        customerId,
      },
    );
    if (!user?.email) {
      throw new Error(ERRORS.SOMETHING_WENT_WRONG);
    }

    const freeSubscriptionStripeId =
      user.subscription.planKey === PLANS.FREE
        ? user.subscription.stripeId
        : undefined;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    await handleUpdateSubscription(ctx, user, subscription);

    await sendSubscriptionSuccessEmail({
      email: user.email,
      subscriptionId,
    });

    // Cancel free subscription. — User upgraded to a paid plan.
    // Not required, but it's a good practice to keep just a single active plan.
    const subscriptions = (
      await stripe.subscriptions.list({ customer: customerId })
    ).data.map((sub) => sub.items);

    if (subscriptions.length > 1) {
      const freeSubscription = subscriptions.find((sub) =>
        sub.data.some(
          ({ subscription }) => subscription === freeSubscriptionStripeId,
        ),
      );
      if (freeSubscription) {
        await stripe.subscriptions.cancel(
          freeSubscription?.data[0].subscription,
        );
      }
    }
  }

  if (session.mode === "payment") {
    const customerId = session.customer as string;
    if (!customerId) {
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }

    const retreivedSession = await stripe.checkout.sessions.retrieve(
      session.id,
      { expand: ["line_items"] },
    );

    const lineItems = retreivedSession.line_items;
    if (lineItems && lineItems.data.length > 0) {
      const priceId = lineItems.data[0]?.price?.id ?? undefined;

      if (priceId) {
        let creditsToAdd = 0;

        if (priceId === STRIPE_SMALL_CREDIT_PACK) {
          creditsToAdd = 50;
        } else if (priceId === STRIPE_MEDIUM_CREDIT_PACK) {
          creditsToAdd = 150;
        } else if (priceId === STRIPE_LARGE_CREDIT_PACK) {
          creditsToAdd = 500;
        }

        if (creditsToAdd > 0) {
          await ctx.runMutation(internal.credits.addCredits, {
            customerId,
            credits: creditsToAdd,
          });
        }
      }
    }
  }
  return new Response(null);
};

const handleCheckoutSessionCompletedError = async (
  ctx: ActionCtx,
  event: Stripe.CheckoutSessionCompletedEvent,
) => {
  const session = event.data.object;

  const { customer: customerId, subscription: subscriptionId } = z
    .object({ customer: z.string(), subscription: z.string() })
    .parse(session);

  const user = await ctx.runQuery(internal.stripe.PREAUTH_getUserByCustomerId, {
    customerId,
  });
  if (!user?.email) throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);

  await sendSubscriptionErrorEmail({
    email: user.email,
    subscriptionId,
  });
  return new Response(null);
};

const handleCustomerSubscriptionUpdated = async (
  ctx: ActionCtx,
  event: Stripe.CustomerSubscriptionUpdatedEvent,
) => {
  const subscription = event.data.object;
  const { customer: customerId } = z
    .object({ customer: z.string() })
    .parse(subscription);

  const user = await ctx.runQuery(internal.stripe.PREAUTH_getUserByCustomerId, {
    customerId,
  });
  if (!user) throw new Error(ERRORS.SOMETHING_WENT_WRONG);

  await handleUpdateSubscription(ctx, user, subscription);

  return new Response(null);
};

const handleCustomerSubscriptionUpdatedError = async (
  ctx: ActionCtx,
  event: Stripe.CustomerSubscriptionUpdatedEvent,
) => {
  const subscription = event.data.object;

  const { id: subscriptionId, customer: customerId } = z
    .object({ id: z.string(), customer: z.string() })
    .parse(subscription);

  const user = await ctx.runQuery(internal.stripe.PREAUTH_getUserByCustomerId, {
    customerId,
  });
  if (!user?.email) throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);

  await sendSubscriptionErrorEmail({
    email: user.email,
    subscriptionId,
  });
  return new Response(null);
};

const handleCustomerSubscriptionDeleted = async (
  ctx: ActionCtx,
  event: Stripe.CustomerSubscriptionDeletedEvent,
) => {
  const subscription = event.data.object;
  await ctx.runMutation(internal.stripe.PREAUTH_deleteSubscription, {
    subscriptionStripeId: subscription.id,
  });
  return new Response(null);
};

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await getStripeEvent(request);

    try {
      switch (event.type) {
        /**
         * Occurs when a Checkout Session has been successfully completed.
         */
        case "checkout.session.completed": {
          return handleCheckoutSessionCompleted(ctx, event);
        }

        /**
         * Occurs when a Stripe subscription has been updated.
         * E.g. when a user upgrades or downgrades their plan.
         */
        case "customer.subscription.updated": {
          return handleCustomerSubscriptionUpdated(ctx, event);
        }

        /**
         * Occurs whenever a customer’s subscription ends.
         */
        case "customer.subscription.deleted": {
          return handleCustomerSubscriptionDeleted(ctx, event);
        }
      }
    } catch (err: unknown) {
      switch (event.type) {
        case "checkout.session.completed": {
          return handleCheckoutSessionCompletedError(ctx, event);
        }

        case "customer.subscription.updated": {
          return handleCustomerSubscriptionUpdatedError(ctx, event);
        }
      }

      throw err;
    }

    return new Response(null);
  }),
});

http.route({
  path: "/chat-stream",
  method: "POST",
  handler: streamChat,
});

http.route({
  path: "/chat-stream",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Digest, Authorization",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response();
    }
  }),
});

auth.addHttpRoutes(http);

export default http;
