'use client'

import Link from 'next/link'

export default function Error({ reset }) {
  return (
    <div className="page-container">
      <p style={{ color: 'var(--color-negative)' }}>Failed to load account holdings.</p>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <button onClick={() => reset()}>Retry</button>
        <Link href="/portfolio">Back to Portfolio</Link>
      </div>
    </div>
  )
}
