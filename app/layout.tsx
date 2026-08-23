import type { Metadata } from "next";
import { DoorShell } from "./components/DoorShell";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="min-h-screen bg-zinc-950 text-stone-200">
        <DoorShell>{children}</DoorShell>
      </body>
    </html>
  );
}
