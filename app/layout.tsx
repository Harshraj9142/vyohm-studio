import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vyohm Studio — AI website builder",
  description: "Describe your business, get a landing page, edit it visually, and export a Next.js project.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
