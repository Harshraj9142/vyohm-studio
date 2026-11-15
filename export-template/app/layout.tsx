import type { Metadata } from "next";
import type { ReactNode } from "react";
import page from "@/data/page.json";
import "@/components/site/site.css";
import "./globals.css";

export const metadata: Metadata = {
  title: page.root.props.title,
  description: page.root.props.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
