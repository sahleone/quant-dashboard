'use client'

import Link from 'next/link'

export default function Error({ reset }) {
  return (
    <div className="page-container">
      <div className="error-msg">
        <h3>Failed to load portfolio</h3>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-primary" onClick={() => reset()}>Retry</button>
          <Link href="/dashboard" style={{ fontSize: '0.875rem', alignSelf: 'center' }}>Back to dashboard</Link>
        </div>
      </div>
    </div>
  )
}
