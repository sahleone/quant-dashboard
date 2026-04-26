import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Login from '@/components/login/Login'
import Signup from '@/components/login/Signup'

export default async function HomePage() {
  const cookieStore = await cookies()
  if (cookieStore.get('jwt')) {
    redirect('/dashboard')
  }

  return (
    <div className="home-page">
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1>QuantDashboard</h1>
        <p>Track performance, analyze risk, and understand your investments.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '3rem', maxWidth: 800, width: '100%' }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>Portfolio Analytics</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>CAGR, Sharpe Ratio, Max Drawdown</p>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>Brokerage Sync</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Connect via SnapTrade — read-only</p>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>Synced Holdings</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Positions and balances from your brokerage</p>
        </div>
      </div>

      <div className="auth-forms">
        <Login />
        <Signup />
      </div>
    </div>
  )
}
