'use client'

import { useState } from "react";

function TabPanel({ tabs = [] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!tabs.length) return null;

  return (
    <div className="tab-panel">
      <div className="tab-panel__nav">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            className={`tab-btn${i === activeIndex ? " tab-btn--active" : ""}`}
            onClick={() => setActiveIndex(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-panel__content">{tabs[activeIndex]?.content}</div>

      <style jsx>{`
        .tab-panel__nav {
          display: flex;
          gap: 0.5rem;
          border-bottom: 1px solid var(--color-border);
          margin-bottom: 1.5rem;
          overflow-x: auto;
        }
        .tab-btn {
          background: transparent;
          color: var(--color-text-muted);
          border: none;
          border-bottom: 2px solid transparent;
          padding: 0.65rem 1.1rem;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: color 0.2s, border-color 0.2s;
          margin-bottom: -1px;
        }
        .tab-btn:hover {
          color: var(--color-text);
        }
        .tab-btn--active {
          color: var(--color-primary);
          border-bottom-color: var(--color-primary);
        }
      `}</style>
    </div>
  );
}

export default TabPanel;
