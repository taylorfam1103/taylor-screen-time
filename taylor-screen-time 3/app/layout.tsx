import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taylor Screen Time",
  description: "Taylor family screen time tracker",
  applicationName: "Taylor Screen Time",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Screen Time"
  },
  icons: {
    apple: "/icons/icon-192.png",
    icon: "/icons/icon-192.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#071426"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
