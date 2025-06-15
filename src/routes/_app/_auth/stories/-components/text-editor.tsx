import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { EditorContent, EditorProvider, useCurrentEditor } from "@tiptap/react";
import { extensions } from "~/src/utils/extensions";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const editorCharCount = new Map<Id<"story">, number>();
const editorCharCountListeners = new Map<Id<"story">, Set<() => void>>();

function useSharedCharacterCount(id: Id<"story">) {
  const [count, setCount] = useState(editorCharCount.get(id) ?? 0);

  useEffect(() => {
    let listeners = editorCharCountListeners.get(id);
    if (!listeners) {
      listeners = new Set();
      editorCharCountListeners.set(id, listeners);
    }
    const listener = () => {
      setCount(editorCharCount.get(id) ?? 0);
    };
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
    };
  }, [id]);

  return count;
}

export const useEditorCharacterCount = useSharedCharacterCount;

function CharCountUpdater({ id }: { id: Id<"story"> }) {
  const { editor } = useCurrentEditor();

  useEffect(() => {
    if (!editor) {
      return;
    }
    // The CharacterCount extension must be enabled for this to work
    if (!editor.storage.characterCount) {
      console.warn(
        "Tiptap CharacterCount extension is not enabled. Character count will not be available.",
      );
      return;
    }

    const updateState = () => {
      const charCount = editor.storage.characterCount.characters();
      editorCharCount.set(id, charCount);
      editorCharCountListeners.get(id)?.forEach((cb) => cb());
    };
    editor.on("update", updateState);
    updateState(); // Initial count
    return () => {
      editor.off("update", updateState);
    };
  }, [editor, id]);

  return null;
}

export function TextEditor(props: { id: Id<"story"> }) {
  const sync = useTiptapSync(api.prosemirror, props.id, { debug: true });
  const { t } = useTranslation();

  return sync.initialContent !== null ? (
    <EditorProvider
      content={sync.initialContent}
      extensions={[...extensions, sync.extension]}
      editorProps={{
        attributes: {
          class:
            "prose prose-lg dark:prose-invert focus:outline-none max-w-none h-full",
        },
      }}
    >
      <CharCountUpdater id={props.id} />
      <EditorContent editor={null} className="h-full" />
    </EditorProvider>
  ) : (
    <p>{t("loadingEditor")}</p>
  );
}
