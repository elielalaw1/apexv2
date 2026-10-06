import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "apexVIP · Analysis workspace",
  description:
    "Record and analyze physiological signals in one workspace.",
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
