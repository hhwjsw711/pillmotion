"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import crypto from "crypto";
import { Resend } from "resend";
import { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import Replicate from "replicate"; // [ADD] Import Replicate client

// Helper type for headers, since they are not easily validatable with v.object
const anyObject = v.any();

export const handle = internalAction({
  args: {
    headers: anyObject,
    body: v.string(),
    url: v.string(),
  },
  handler: async (ctx, { headers, body, url }) => {
    // [ADD] Initialize Replicate client inside the handler
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    try {
      // --- 1. Signature Validation (Upgraded to Dynamic Method) ---
      const id = headers["webhook-id"];
      const timestamp = headers["webhook-timestamp"];
      const signatureHeader = headers["webhook-signature"];

      if (!id || !timestamp || !signatureHeader) {
        console.error("Missing webhook headers");
        return; // Exit silently
      }

      const signedContent = `${id}.${timestamp}.${body}`;
      // [FIX] Dynamically fetch the current signing secret from Replicate API
      const secret = await replicate.webhooks.default.secret.get();
      const secretBytes = Buffer.from(secret.key.split("_")[1], "base64");

      const expectedSignature = crypto
        .createHmac("sha256", secretBytes)
        .update(signedContent)
        .digest("base64");

      const isValid = signatureHeader
        .split(" ")
        .some((sig: string) => sig.split(",")[1] === expectedSignature);

      if (!isValid) {
        console.warn("Invalid Replicate webhook signature received.");
        return; // Exit silently
      }

      // --- 2. Logic (Unchanged) ---
      const characterId = new URL(url).searchParams.get(
        "characterId",
      ) as Id<"characters"> | null;

      if (!characterId) {
        console.error("Webhook received without a characterId.");
        return;
      }

      const payload = JSON.parse(body);
      const { status, output, error } = payload;

      const character = await ctx.runQuery(api.characters.getSystem, {
        characterId,
      });
      if (!character) {
        console.error(`Character not found for webhook: ${characterId}`);
        return;
      }

      console.log(`Webhook for ${characterId}: ${status}`);

      // [FIX] Use AUTH_RESEND_KEY for consistency
      const resendApiKey = process.env.AUTH_RESEND_KEY;
      const user = await ctx.runQuery(internal.app.get, {
        userId: character.userId,
      });

      if (status === "succeeded") {
        await ctx.runMutation(internal.characters.updateTrainingStatus, {
          characterId: characterId,
          status: "ready",
          replicateModelVersion: output.version,
        });
        if (resendApiKey && user?.email) {
          const resend = new Resend(resendApiKey);
          await resend.emails.send({
            from: "Pillmotion <noreply@pillmotion.com>",
            to: [user.email],
            subject: "✅ Your character is ready!",
            text: `Hi ${
              user.name ?? ""
            }, your character "${character.name}" has finished training and is now ready to be used in your stories!`,
          });
        }
      } else {
        await ctx.runMutation(internal.characters.updateTrainingStatus, {
          characterId: characterId,
          status: "failed",
          failureReason: error
            ? JSON.stringify(error)
            : "Training failed/canceled.",
        });
        await ctx.runMutation(internal.credits.refundTrainingCredits, {
          userId: character.userId,
        });
        if (resendApiKey && user?.email) {
          const resend = new Resend(resendApiKey);
          await resend.emails.send({
            from: "Pillmotion <noreply@pillmotion.com>",
            to: [user.email],
            subject: "❌ Character training failed",
            text: `Hi ${
              user.name ?? ""
            }, unfortunately, the training for your character "${character.name}" has failed. We have refunded the credits to your account.`,
          });
        }
      }

      await ctx.runAction(internal.characters.cleanupTrainingData, {
        characterId,
      });
    } catch (err: any) {
      console.error("Webhook handler failed:", err.message);
    }
  },
});
