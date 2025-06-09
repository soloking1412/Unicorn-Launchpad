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
          <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white relative">
            {/* Background pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.05]"></div>
            
            {/* Navigation */}
            <nav className="container mx-auto px-4 py-6 relative z-10">
              <div className="flex justify-between items-center backdrop-blur-sm bg-gray-900/30 rounded-full px-6 py-3 border border-gray-800/50">
                <Link href="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all duration-300">
                  Unicorn Factory
                </Link>
                <div className="flex items-center gap-6">
                  <Link href="/projects" className="text-gray-300 hover:text-white transition-colors">
                    Projects
                  </Link>
                  <Link href="/submit-project" className="text-gray-300 hover:text-white transition-colors">
                    Submit
                  </Link>
                  <WalletConnectButton />
                </div>
              </div>
            </nav>
            
            <div className="relative z-10">
              {children}
            </div>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
