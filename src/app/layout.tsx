import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "apexVIP · Analysplattform",
  description:
    "Fysiologiska signaler, sessioner och forskning i en gemensam arbetsyta.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
