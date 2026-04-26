export default function Loading() {
  return (
    <div className="page-container">
      <div style={{ height: '2.5rem', width: '14rem', background: 'var(--color-surface)', borderRadius: 4, marginBottom: '1.5rem', opacity: 0.6 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: '5rem', background: 'var(--color-surface)', borderRadius: 'var(--radius)', opacity: 0.6 }} />
        ))}
      </div>
    </div>
  )
}
