import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KinderVault — Personal Knowledge Vault",
  description:
    "Personal Markdown knowledge vault built with Next.js and Supabase featuring Zettelkasten, Daily Journal, Inbox triage, and Full-Text Search.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
