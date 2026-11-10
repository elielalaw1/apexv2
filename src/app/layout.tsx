import type { Metadata } from "next";
import "./globals.css";
import "./session-workspace.css";
import "./review-customization.css";
import "./mvp-appearance.css";
export const metadata: Metadata = {
  title: "APEX · Session review",
  description: "Record and analyze physiological signals in one workspace.",
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
