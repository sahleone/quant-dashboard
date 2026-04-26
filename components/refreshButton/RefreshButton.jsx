'use client'

import { useState } from "react";
import { authenticatedPost } from "@/utils/apiClient";

function RefreshButton({ onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleRefresh = async () => {
    setLoading(true);
    setMessage(null);
    try {

      await authenticatedPost("/api/connections/refresh");

      await authenticatedPost("/api/metrics/calculate", { fullSync: false });
      setMessage({ type: "success", text: "Data refreshed" });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Refresh error:", err);
      setMessage({ type: "error", text: "Refresh failed" });
    } finally {
      setLoading(false);

      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <button
        className="btn-secondary"
        onClick={handleRefresh}
        disabled={loading}
        title="Sync latest data from your connected brokerages"
      >
        {loading ? "Syncing..." : "Refresh Data"}
      </button>
      {message && (
        <span
          style={{
            fontSize: "0.85rem",
            color: message.type === "success" ? "var(--color-accent)" : "var(--color-danger)",
          }}
        >
          {message.text}
        </span>
      )}
    </div>
  );
}

export default RefreshButton;
