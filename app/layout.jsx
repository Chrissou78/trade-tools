import './globals.css'

export const metadata = {
  title: 'Solana Tools Suite',
  description: 'All-in-one platform for Solana wallet generation',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
