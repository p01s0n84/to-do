import './globals.css'  // <-- QUESTA RIGA MANCA!

export const metadata = { title: 'Denthera Tasks' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-white text-gray-900">{children}</body>
    </html>
  )
}