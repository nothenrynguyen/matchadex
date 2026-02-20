import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "./components/Navbar";
import Footer from "./components/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "MatchaDex",
  description: "Find the best matcha cafes near you.",
  openGraph: {
    images: ["/preview.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/preview.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="h-dvh antialiased flex flex-col overflow-hidden">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to main content
        </a>
        <header className="border-b border-emerald-100 bg-[#f3f1e7] flex-none">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <Link href="/cafes" className="text-lg font-semibold text-emerald-900">
              MatchaDex
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <Navbar />
            </div>
          </div>
        </header>
        <main id="main-content" className="flex-1 min-h-0 overflow-hidden">
          {children}
        </main>
        <footer className="flex-none">
          <Footer />
        </footer>
      </body>
    </html>
  );
}
