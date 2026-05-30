import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { Toaster } from 'react-hot-toast'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'CodeForge AI | Autonomous Software Engineer',
    template: '%s | CodeForge AI',
  },
  description:
    'CodeForge AI is your autonomous AI software engineer. Understand any codebase, generate features, review PRs, scan for vulnerabilities, and write tests — all powered by multi-agent AI.',
  keywords: ['AI', 'code', 'software engineer', 'LLM', 'code review', 'code generation', 'RAG'],
  authors: [{ name: 'CodeForge AI' }],
  creator: 'CodeForge AI',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://codeforge.ai',
    title: 'CodeForge AI | Autonomous Software Engineer',
    description: 'Your autonomous AI software engineer. Multi-agent AI for any codebase.',
    siteName: 'CodeForge AI',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'CodeForge AI' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CodeForge AI | Autonomous Software Engineer',
    description: 'Your autonomous AI software engineer. Multi-agent AI for any codebase.',
    images: ['/og-image.png'],
    creator: '@codeforgeai',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  themeColor: '#0c0e14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans bg-surface-950 text-slate-100 antialiased`}>
        <QueryProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'rgba(20, 23, 32, 0.95)',
                color: '#f1f5f9',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(16px)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#22c55e', secondary: '#0c0e14' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#0c0e14' },
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  )
}
