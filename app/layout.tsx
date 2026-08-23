import type { Metadata } from "next";
import { DoorShell } from "./components/DoorShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "gantree",
  description: "Shipping yard for ai-gantry",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-stone-200">
        <DoorShell>{children}</DoorShell>
      </body>
    </html>
  );
}
