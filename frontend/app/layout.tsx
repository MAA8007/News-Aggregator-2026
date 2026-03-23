import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "News",
  description: "News",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="relative overflow-x-hidden" style={{ backgroundColor: "var(--bg-base)" }}>
        {children}
      </body>
    </html>
  );
}