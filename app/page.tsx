import type { Metadata } from "next";
import { Landing } from "@/components/marketing/Landing";

export const metadata: Metadata = {
  title: "Vyohm Studio — describe your business, get a website you own",
  description:
    "Vyohm Studio turns one sentence into a polished landing page. Edit it visually or with AI, then export a real Next.js project.",
};

export default function Home() {
  return <Landing />;
}
