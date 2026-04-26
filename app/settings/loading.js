export default function Loading() {
  return (
    <div className="page-container">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '480px' }}>
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div style={{ height: '1rem', width: '6rem', background: 'var(--color-surface)', borderRadius: 4, marginBottom: '0.5rem', opacity: 0.6 }} />
            <div style={{ height: '2.5rem', background: 'var(--color-surface)', borderRadius: 4, opacity: 0.6 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
