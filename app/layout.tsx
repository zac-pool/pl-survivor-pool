import './globals.css'

export const metadata = {
  title: 'PL Survivor Pool',
  description: 'Premier League survivor pool tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f7f5ff] text-[#1c1230] antialiased">
        {children}
      </body>
    </html>
  )
}
