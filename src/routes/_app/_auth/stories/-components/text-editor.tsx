import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { EditorContent, EditorProvider } from "@tiptap/react";
import { extensions } from "~/src/utils/extensions";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";

export function TextEditor(props: { id: Id<"story"> }) {
  const sync = useTiptapSync(api.prosemirror, props.id, { debug: true });

  return sync.initialContent !== null ? (
    <EditorProvider
      content={sync.initialContent}
      extensions={[...extensions, sync.extension]}
      editorProps={{
        attributes: {
          class:
            "prose prose-lg dark:prose-invert focus:outline-none max-w-none",
        },
      }}
    >
      <EditorContent editor={null} />
    </EditorProvider>
  ) : (
    <p>Loading...</p>
  );
}