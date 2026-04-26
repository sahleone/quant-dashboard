export default function Loading() {
  return (
    <div className="page-container">
      <div style={{ height: '2rem', width: '8rem', background: 'var(--color-surface)', borderRadius: 4, marginBottom: '1.5rem', opacity: 0.6 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: '2.75rem', background: 'var(--color-surface)', borderRadius: 4, opacity: 0.6 }} />
        ))}
      </div>
    </div>
  )
}
