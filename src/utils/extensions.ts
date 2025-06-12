import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import CharacterCount from "@tiptap/extension-character-count";

export const extensions = [
  StarterKit,
  TaskItem.configure({
    nested: true,
  }),
  TaskList,
  Typography,
  Underline,
  CharacterCount,
];
