import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ghaem Downloader | مدیریت",
  description: "پنل مدیریت دانلودهای Ghaem Downloader",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
