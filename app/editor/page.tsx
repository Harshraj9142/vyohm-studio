import type { Metadata } from "next";
import { Editor } from "@/components/editor/Editor";

export const metadata: Metadata = {
  title: "Editor — Vyohm Studio",
};

export default function EditorPage() {
  return <Editor />;
}
