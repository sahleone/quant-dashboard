'use client'

import { useState, useEffect } from "react";
import { authenticatedGet, authenticatedDelete } from "@/utils/apiClient";
import ConnectBrokerage from "@/components/connectBrokerage/ConnectBrokerage";

function Connections({ onDisconnect }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const fetchConnections = async () => {
    try {
      const res = await authenticatedGet("/api/connections");
      setConnections(res.data?.connections || []);
    } catch (err) {
      console.error("Connections fetch error:", err);
      setError("Could not load brokerage connections.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleRemove = async (authorizationId) => {
    if (!confirm("Remove this brokerage connection?")) return;
    setRemovingId(authorizationId);
    try {
      await authenticatedDelete(`/api/connections/${authorizationId}`);
      setConnections((prev) => prev.filter((c) => c.id !== authorizationId));
      if (onDisconnect) onDisconnect();
    } catch (err) {
      console.error("Remove connection error:", err);
      alert("Failed to remove connection");
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) return <div className="loading">Loading connections...</div>;
  if (error) return <div className="error-msg">{error}</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Connected Brokerages</h3>
        <ConnectBrokerage onConnected={fetchConnections} />
      </div>

      {connections.length === 0 ? (
        <div
          style={{
            background: "var(--color-surface-2)",
            border: "1px dashed var(--color-border)",
            borderRadius: "var(--radius)",
            padding: "2rem",
            textAlign: "center",
            color: "var(--color-text-muted)",
          }}
        >
          <p>No brokerages connected yet.</p>
          <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
            Click &quot;Connect Brokerage&quot; to link your investment accounts.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {connections.map((conn) => (
            <div
              key={conn.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                padding: "1rem 1.25rem",
              }}
            >
              <div>
                <p style={{ fontWeight: 600, marginBottom: "0.2rem" }}>
                  {conn.brokerageName || conn.brokerage?.name || "Unknown Brokerage"}
                </p>
                <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  {conn.accountCount ? `${conn.accountCount} account(s)` : "Connected"}
                  {conn.createdDate && ` - since ${new Date(conn.createdDate).toLocaleDateString()}`}
                </p>
              </div>
              <button
                className="btn-secondary"
                style={{ fontSize: "0.82rem", padding: "0.4rem 0.85rem", color: "var(--color-danger)", borderColor: "var(--color-danger)" }}
                onClick={() => handleRemove(conn.id)}
                disabled={removingId === conn.id}
              >
                {removingId === conn.id ? "Removing..." : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Connections;
