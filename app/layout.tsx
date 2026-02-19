import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Navbar from "./components/Navbar";
import MetroSelector from "./components/metro-selector";
import Footer from "./components/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "MatchaDex",
  description: "Discover and review matcha cafes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to main content
        </a>
        <header className="border-b border-emerald-100 bg-[#f3f1e7]">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <Link href="/cafes" className="text-lg font-semibold text-emerald-900">
              MatchaDex
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <Suspense fallback={null}>
                <MetroSelector />
              </Suspense>
              <Navbar />
            </div>
          </div>
        </header>
        <main id="main-content" className="min-h-screen">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
