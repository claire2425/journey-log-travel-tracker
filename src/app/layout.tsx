import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Journey Log",
  applicationName: "Journey Log",
  description: "A private, local-first travel log with optional encrypted-in-transit cloud sync.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Journey Log",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
