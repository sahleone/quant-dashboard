'use client'

export default function Error({ reset }) {
  return (
    <div className="page-container">
      <div className="error-msg">
        <h3>Failed to load asset allocation</h3>
        <button className="btn-primary" onClick={() => reset()}>Retry</button>
      </div>
    </div>
  )
}
