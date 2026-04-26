export default function Loading() {
  return (
    <div className="page-container">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: '6rem', background: 'var(--color-surface)', borderRadius: 'var(--radius)', opacity: 0.6 }} />
        ))}
      </div>
      <div style={{ height: '18rem', background: 'var(--color-surface)', borderRadius: 'var(--radius)', opacity: 0.6 }} />
    </div>
  )
}
