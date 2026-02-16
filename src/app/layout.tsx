import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sprinkler Services",
  description: "Schedule sprinkler blowout and backflow prevention testing services online",
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
