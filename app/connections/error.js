'use client'

export default function Error({ error, reset }) {
  return (
    <div className="error-msg">
      <p>Failed to load connections.</p>
      <button onClick={() => reset()}>Retry</button>
    </div>
  )
}
