import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { EditorContent, EditorProvider } from "@tiptap/react";
import { extensions } from "~/src/utils/extensions";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";

export function TextEditor(props: { id: Id<"story"> }) {
  const sync = useTiptapSync(api.prosemirror, props.id, { debug: true });
  if (!sync.isLoading && sync.initialContent === null) {
    sync.create({ type: "doc", content: [] });
  }
  return sync.initialContent !== null ? (
    <EditorProvider
      content={sync.initialContent}
      extensions={[...extensions, sync.extension]}
      editorProps={{
        attributes: {
          class:
            "prose prose-sm dark:prose-invert sm:prose-base focus:outline-none",
        },
      }}
    >
      <EditorContent editor={null} />
    </EditorProvider>
  ) : (
    <p>Loading...</p>
  );
}
