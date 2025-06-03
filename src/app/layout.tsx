import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Link from "next/link";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Unicorn Factory - AI Startup Launchpad",
  description: "Launch your AI startup with community funding on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
            <nav className="container mx-auto px-4 py-4">
              <div className="flex justify-between items-center">
                <Link href="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                  Unicorn Factory
                </Link>
                <WalletConnectButton />
              </div>
            </nav>
            {children}
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
