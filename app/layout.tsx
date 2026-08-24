import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { DoorShell } from "./components/shared/DoorShell";
import { DEFAULT_THEME, THEME_BOOT, themeCss, themeOf } from "./lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "gantree",
  description: "Shipping yard for ai-gantry",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: themeOf(DEFAULT_THEME).tokens.canvas,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="yard" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="min-h-screen min-w-0 overflow-x-clip bg-canvas text-body">
        <Suspense fallback={<p className="px-6 py-10 text-sm text-dim">opening the door…</p>}>
          <DoorShell>{children}</DoorShell>
        </Suspense>
      </body>
    </html>
  );
}
