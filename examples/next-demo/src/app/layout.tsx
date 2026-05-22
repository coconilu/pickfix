import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShipFast — Launch Your SaaS in Days",
  description: "A SaaS boilerplate for indie hackers",
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
