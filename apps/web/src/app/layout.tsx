import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PickFix — Preview-Driven Development",
  description: "Point, pick, fix — preview-driven development with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
