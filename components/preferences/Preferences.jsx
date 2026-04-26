'use client'

import { useState, useEffect } from "react";
import { authenticatedGet, authenticatedPatch } from "@/utils/apiClient";

const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "JPY", "AUD", "CHF"];

function Preferences() {
  const [prefs, setPrefs] = useState({ baseCurrency: "USD" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const res = await authenticatedGet("/api/user/me");
        const userPrefs = res.data?.user?.preferences;
        if (userPrefs) setPrefs(userPrefs);
      } catch (err) {
        console.error("Preferences fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPrefs((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await authenticatedPatch("/api/user/me", { preferences: prefs });
      setMessage({ type: "success", text: "Preferences saved!" });
    } catch (err) {
      console.error("Preferences save error:", err);
      setMessage({ type: "error", text: "Could not save preferences." });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  if (loading) return <div className="loading">Loading preferences...</div>;

  return (
    <div>
      <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1.25rem" }}>
        Display Preferences
      </h3>

      <div style={{ display: "grid", gap: "1.25rem", maxWidth: 400 }}>
        <div>
          <label htmlFor="baseCurrency">Display Currency</label>
          <select id="baseCurrency" name="baseCurrency" value={prefs.baseCurrency} onChange={handleChange}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Preferences"}
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
      </div>
    </div>
  );
}

export default Preferences;
