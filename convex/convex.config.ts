import { defineApp } from "convex/server";
import r2 from "@convex-dev/r2/convex.config";
import rag from "@convex-dev/rag/convex.config";

const app = defineApp();
app.use(r2);
app.use(rag);

export default app;
