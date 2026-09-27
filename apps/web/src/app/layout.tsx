import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../context/auth-context';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'AI Interview Prep Kit | Trao Assessment',
  description:
    'Turn job descriptions and company websites into structured, personalized interview preparation kits with deterministic coverage checking and schedule allocation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
        {/* Accessible skip link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
        >
          Skip to main content
        </a>

        <AuthProvider>
          <Header />
          
          <main id="main-content" className="flex-1">
            {children}
          </main>

          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
