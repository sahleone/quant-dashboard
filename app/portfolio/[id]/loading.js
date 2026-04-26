export default function Loading() {
  return (
    <div className="page-container">
      <div style={{ height: '1.5rem', width: '12rem', background: 'var(--color-surface)', borderRadius: 4, marginBottom: '1.5rem' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ height: '2.5rem', background: 'var(--color-surface)', borderRadius: 4, opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    </div>
  )
}
