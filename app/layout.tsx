import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "gantree",
  description: "Shipping yard for ai-gantry",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-stone-200">
        <header className="border-b border-zinc-800 px-6 py-3">
          <div className="mx-auto flex max-w-6xl items-baseline justify-between gap-4">
            <Link href="/" className="text-lg font-semibold tracking-tight text-amber-500">
              gantree
            </Link>
            <p className="text-xs text-zinc-500">shipping yard · not the chat</p>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
