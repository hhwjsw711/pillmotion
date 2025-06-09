import { defineApp } from "convex/server";
import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config";
import persistentTextStreaming from "@convex-dev/persistent-text-streaming/convex.config";

const app = defineApp();
app.use(prosemirrorSync);
app.use(persistentTextStreaming);

export default app;