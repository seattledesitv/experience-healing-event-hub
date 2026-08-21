import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Experience Healing Event Hub",
  description: "Create once and publish Experience Healing events everywhere.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
