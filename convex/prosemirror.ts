import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { action, internalMutation, mutation } from "./_generated/server";
import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { getSchema } from "@tiptap/core";
import { Transform, Step } from "@tiptap/pm/transform";
import { EditorState } from "@tiptap/pm/state";
import { extensions } from "~/src/utils/extensions";
import { Id } from "./_generated/dataModel";

export const prosemirrorSync = new ProsemirrorSync<Id<"story">>(
  components.prosemirrorSync,
);
export const {
  getSnapshot,
  submitSnapshot,
  latestVersion,
  getSteps,
  submitSteps,
} = prosemirrorSync.syncApi({
  checkRead(_ctx, _id) {
    // const user = await userFromAuth(ctx);
    // ...validate that the user can read this document
  },
  checkWrite(_ctx, _id) {
    // const user = await userFromAuth(ctx);
    // ...validate that the user can write to this document
  },
  async onSnapshot(ctx, id, snapshot, _version) {
    // ...do something with the snapshot, like store a copy in another table,
    // save a text version of the document for text search, or generate
    // embeddings for vector search.
    const snapshotJSON = JSON.parse(snapshot);
    if (!snapshotJSON.content) return;

    // --- START: ELEGANT SCRIPT EXTRACTION ---
    const schema = getSchema(extensions);
    const node = schema.nodeFromJSON(snapshotJSON);

    // Instead of node.textContent, we iterate through each paragraph.
    const paragraphs: string[] = [];
    node.forEach(paragraphNode => {
      // We only care about nodes that are paragraphs and are not empty.
      if (paragraphNode.type.name === 'paragraph' && paragraphNode.textContent.trim() !== '') {
        paragraphs.push(paragraphNode.textContent);
      }
    });

    // We reconstruct the script, preserving the paragraph structure with double newlines.
    // This makes it compatible with our backend logic!
    const script = paragraphs.join('\n\n');
    // --- END: ELEGANT SCRIPT EXTRACTION ---

    await ctx.scheduler.runAfter(0, internal.prosemirror.updateDocSearchIndex, {
      id,
      script,
    });
  },
});

async function generateContent(doc: string) {
  return `Overall length: ${doc.length}`;
}

// We keep a text search index on the documents table for easy search.
// But we don't update that full version all the time, for efficiency.
export const updateDocSearchIndex = internalMutation({
  args: { id: v.id("story"), script: v.string() },
  handler: async (ctx, { id, script }) => {
    const story = await ctx.db.get(id);
    if (!story) {
      throw new Error("Story not found");
    }
    await ctx.db.patch(id, {
      script,
      updatedAt: Date.now()
    });
  },
});

// This is an example of how to modify a document using the transform fn.
export const transformExample = action({
  args: { id: v.id("story") },
  handler: async (ctx, { id }) => {
    const schema = getSchema(extensions);
    const { doc, version } = await prosemirrorSync.getDoc(ctx, id, schema);
    const newContent = await generateContent(doc.textContent);
    const node = await prosemirrorSync.transform(ctx, id, schema, (doc, v) => {
      if (v !== version) {
        // If we wanted to avoid making changes, we could return null here.
        // Or we could rebase our changes on top of the new document.
      }
      const tr = EditorState.create({ doc }).tr;
      return tr.insertText(newContent, 0);
    });
    await ctx.scheduler.runAfter(0, internal.prosemirror.updateDocSearchIndex, {
      id,
      script: node.textContent,
    });
  },
});

// This is an example of how to manually transform the document.
export const manualTransform = mutation({
  args: {
    id: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { id, text }) => {
    const snapshot = await ctx.runQuery(
      components.prosemirrorSync.lib.getSnapshot,
      {
        id,
      },
    );
    if (!snapshot.content) {
      throw new Error("Document not found");
    }
    const content = JSON.parse(snapshot.content);
    const schema = getSchema(extensions);
    const serverVersion = new Transform(schema.nodeFromJSON(content));
    const stepsResult = await ctx.runQuery(
      components.prosemirrorSync.lib.getSteps,
      { id, version: snapshot.version },
    );
    if (stepsResult.steps.length > 0) {
      for (const step of stepsResult.steps) {
        serverVersion.step(Step.fromJSON(schema, JSON.parse(step)));
      }
    }
    let version = stepsResult.version;
    while (true) {
      const tr = new Transform(serverVersion.doc);
      tr.insert(0, schema.text(text));

      const result = await ctx.runMutation(
        components.prosemirrorSync.lib.submitSteps,
        {
          id,
          clientId: "server function",
          version,
          steps: tr.steps.map((step) => JSON.stringify(step.toJSON())),
        },
      );
      if (result.status === "synced") {
        await ctx.runMutation(components.prosemirrorSync.lib.submitSnapshot, {
          id,
          version: version + tr.steps.length,
          content: JSON.stringify(tr.doc.toJSON()),
        });
        return tr.doc.toJSON();
      }
      for (const step of result.steps) {
        serverVersion.step(Step.fromJSON(schema, JSON.parse(step)));
      }
      version += result.steps.length;
    }
  },
});
