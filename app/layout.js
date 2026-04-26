import { Providers } from './providers'
import './globals.css'

export const metadata = {
  title: 'QuantDashboard',
  description: 'Portfolio analytics dashboard — track performance, analyze risk, and understand your investments.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
