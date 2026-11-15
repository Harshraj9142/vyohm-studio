import type { Metadata } from "next";
import { StartChat } from "@/components/start/StartChat";

export const metadata: Metadata = {
  title: "Create your landing page — Vyohm Studio",
  description: "Describe your business and Vyohm Studio builds your landing page.",
};

export default function StartPage() {
  return <StartChat />;
}
