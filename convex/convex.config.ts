import { defineApp } from "convex/server";
import persistentTextStreaming from "@convex-dev/persistent-text-streaming/convex.config";
import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config";

const app = defineApp();
app.use(persistentTextStreaming);
app.use(prosemirrorSync);

export default app;