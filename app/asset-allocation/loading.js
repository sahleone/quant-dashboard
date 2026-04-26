export default function Loading() {
  return (
    <div className="page-container">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div style={{ height: '20rem', background: 'var(--color-surface)', borderRadius: 'var(--radius)', opacity: 0.6 }} />
        <div style={{ height: '20rem', background: 'var(--color-surface)', borderRadius: 'var(--radius)', opacity: 0.6 }} />
      </div>
    </div>
  )
}
