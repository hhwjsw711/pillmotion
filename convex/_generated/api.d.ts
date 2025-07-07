/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents_internalMutations from "../agents/internalMutations.js";
import type * as agents_internalQueries from "../agents/internalQueries.js";
import type * as agents_model from "../agents/model.js";
import type * as agents_mutations from "../agents/mutations.js";
import type * as agents_queries from "../agents/queries.js";
import type * as ai_agentReplyToMessage from "../ai/agentReplyToMessage.js";
import type * as ai_history from "../ai/history.js";
import type * as ai_instructions from "../ai/instructions.js";
import type * as ai_messages from "../ai/messages.js";
import type * as ai_tools from "../ai/tools.js";
import type * as ai_triageMessage from "../ai/triageMessage.js";
import type * as ai_utils from "../ai/utils.js";
import type * as app from "../app.js";
import type * as auth from "../auth.js";
import type * as conversationMessages_internalActions from "../conversationMessages/internalActions.js";
import type * as conversationMessages_internalMutations from "../conversationMessages/internalMutations.js";
import type * as conversationMessages_internalQueries from "../conversationMessages/internalQueries.js";
import type * as conversationMessages_model from "../conversationMessages/model.js";
import type * as conversationMessages_mutations from "../conversationMessages/mutations.js";
import type * as conversationMessages_queries from "../conversationMessages/queries.js";
import type * as conversationParticipants_internalMutations from "../conversationParticipants/internalMutations.js";
import type * as conversationParticipants_internalQueries from "../conversationParticipants/internalQueries.js";
import type * as conversationParticipants_model from "../conversationParticipants/model.js";
import type * as conversationParticipants_mutations from "../conversationParticipants/mutations.js";
import type * as conversationParticipants_queries from "../conversationParticipants/queries.js";
import type * as conversations_internalMutations from "../conversations/internalMutations.js";
import type * as conversations_internalQueries from "../conversations/internalQueries.js";
import type * as conversations_model from "../conversations/model.js";
import type * as conversations_mutations from "../conversations/mutations.js";
import type * as conversations_queries from "../conversations/queries.js";
import type * as credits from "../credits.js";
import type * as email_index from "../email/index.js";
import type * as email_templates_subscriptionEmail from "../email/templates/subscriptionEmail.js";
import type * as env from "../env.js";
import type * as generateDecoratedImage from "../generateDecoratedImage.js";
import type * as guidedStory from "../guidedStory.js";
import type * as http from "../http.js";
import type * as images from "../images.js";
import type * as init from "../init.js";
import type * as otp_ResendOTP from "../otp/ResendOTP.js";
import type * as otp_VerificationCodeEmail from "../otp/VerificationCodeEmail.js";
import type * as replicate from "../replicate.js";
import type * as segments from "../segments.js";
import type * as story from "../story.js";
import type * as stripe from "../stripe.js";
import type * as thumbnailMonitor from "../thumbnailMonitor.js";
import type * as users_model from "../users/model.js";
import type * as users_queries from "../users/queries.js";
import type * as utils from "../utils.js";
import type * as videos from "../videos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "agents/internalMutations": typeof agents_internalMutations;
  "agents/internalQueries": typeof agents_internalQueries;
  "agents/model": typeof agents_model;
  "agents/mutations": typeof agents_mutations;
  "agents/queries": typeof agents_queries;
  "ai/agentReplyToMessage": typeof ai_agentReplyToMessage;
  "ai/history": typeof ai_history;
  "ai/instructions": typeof ai_instructions;
  "ai/messages": typeof ai_messages;
  "ai/tools": typeof ai_tools;
  "ai/triageMessage": typeof ai_triageMessage;
  "ai/utils": typeof ai_utils;
  app: typeof app;
  auth: typeof auth;
  "conversationMessages/internalActions": typeof conversationMessages_internalActions;
  "conversationMessages/internalMutations": typeof conversationMessages_internalMutations;
  "conversationMessages/internalQueries": typeof conversationMessages_internalQueries;
  "conversationMessages/model": typeof conversationMessages_model;
  "conversationMessages/mutations": typeof conversationMessages_mutations;
  "conversationMessages/queries": typeof conversationMessages_queries;
  "conversationParticipants/internalMutations": typeof conversationParticipants_internalMutations;
  "conversationParticipants/internalQueries": typeof conversationParticipants_internalQueries;
  "conversationParticipants/model": typeof conversationParticipants_model;
  "conversationParticipants/mutations": typeof conversationParticipants_mutations;
  "conversationParticipants/queries": typeof conversationParticipants_queries;
  "conversations/internalMutations": typeof conversations_internalMutations;
  "conversations/internalQueries": typeof conversations_internalQueries;
  "conversations/model": typeof conversations_model;
  "conversations/mutations": typeof conversations_mutations;
  "conversations/queries": typeof conversations_queries;
  credits: typeof credits;
  "email/index": typeof email_index;
  "email/templates/subscriptionEmail": typeof email_templates_subscriptionEmail;
  env: typeof env;
  generateDecoratedImage: typeof generateDecoratedImage;
  guidedStory: typeof guidedStory;
  http: typeof http;
  images: typeof images;
  init: typeof init;
  "otp/ResendOTP": typeof otp_ResendOTP;
  "otp/VerificationCodeEmail": typeof otp_VerificationCodeEmail;
  replicate: typeof replicate;
  segments: typeof segments;
  story: typeof story;
  stripe: typeof stripe;
  thumbnailMonitor: typeof thumbnailMonitor;
  "users/model": typeof users_model;
  "users/queries": typeof users_queries;
  utils: typeof utils;
  videos: typeof videos;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  r2: {
    lib: {
      deleteMetadata: FunctionReference<
        "mutation",
        "internal",
        { bucket: string; key: string },
        null
      >;
      deleteObject: FunctionReference<
        "mutation",
        "internal",
        {
          accessKeyId: string;
          bucket: string;
          endpoint: string;
          key: string;
          secretAccessKey: string;
        },
        null
      >;
      deleteR2Object: FunctionReference<
        "action",
        "internal",
        {
          accessKeyId: string;
          bucket: string;
          endpoint: string;
          key: string;
          secretAccessKey: string;
        },
        null
      >;
      getMetadata: FunctionReference<
        "query",
        "internal",
        {
          accessKeyId: string;
          bucket: string;
          endpoint: string;
          key: string;
          secretAccessKey: string;
        },
        {
          bucket: string;
          bucketLink: string;
          contentType?: string;
          key: string;
          lastModified: string;
          link: string;
          sha256?: string;
          size?: number;
          url: string;
        } | null
      >;
      listMetadata: FunctionReference<
        "query",
        "internal",
        {
          accessKeyId: string;
          bucket: string;
          cursor?: string;
          endpoint: string;
          limit?: number;
          secretAccessKey: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            bucket: string;
            bucketLink: string;
            contentType?: string;
            key: string;
            lastModified: string;
            link: string;
            sha256?: string;
            size?: number;
            url: string;
          }>;
          pageStatus?: null | "SplitRecommended" | "SplitRequired";
          splitCursor?: null | string;
        }
      >;
      store: FunctionReference<
        "action",
        "internal",
        {
          accessKeyId: string;
          bucket: string;
          endpoint: string;
          secretAccessKey: string;
          url: string;
        },
        any
      >;
      syncMetadata: FunctionReference<
        "action",
        "internal",
        {
          accessKeyId: string;
          bucket: string;
          endpoint: string;
          key: string;
          onComplete?: string;
          secretAccessKey: string;
        },
        null
      >;
      upsertMetadata: FunctionReference<
        "mutation",
        "internal",
        {
          bucket: string;
          contentType?: string;
          key: string;
          lastModified: string;
          link: string;
          sha256?: string;
          size?: number;
        },
        { isNew: boolean }
      >;
    };
  };
};
