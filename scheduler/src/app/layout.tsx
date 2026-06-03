import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "面試預約 · CMoney 招募",
  description: "自建面試自助預約系統",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
