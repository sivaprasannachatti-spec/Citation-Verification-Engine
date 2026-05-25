import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brahmo Citation Safety Engine — Legal AI Guardrail",
  description: "Deterministic citation extractor, pre-filter, verification, and IPC-to-BNS section mapping engine for Indian law drafts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
