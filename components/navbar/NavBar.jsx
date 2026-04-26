'use client'

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContext } from "react";
import UserContext from "@/context/UserContext";
import { usePortfolio } from "@/context/PortfolioContext";
import { authenticatedPost } from "@/utils/apiClient";

function PortfolioScopeSelect() {
  const { accounts, selectedAccountId, setSelectedAccountId, loading } = usePortfolio();

  return (
    <div className="nav-portfolio-scope">
      <label htmlFor="nav-portfolio-select" className="nav-portfolio-label-text">
        Account
      </label>
      <select
        id="nav-portfolio-select"
        className="nav-portfolio-select"
        aria-label="Filter by brokerage account"
        disabled={loading && accounts.length === 0}
        value={selectedAccountId || ""}
        onChange={(e) => setSelectedAccountId(e.target.value || null)}
      >
        <option value="">All accounts</option>
        {accounts.map((a) => (
          <option key={a.accountId} value={a.accountId}>
            {a.accountName || a.institutionName || "Account"}
          </option>
        ))}
      </select>
    </div>
  );
}

function NavBar() {
  const context = useContext(UserContext) || {};
  const { user, setUser } = context;
  const router = useRouter();

  const isAuthenticated = !!user;

  const handleLogout = async () => {
    try {
      await authenticatedPost("/api/auth/logout");
    } catch (error) {
      console.log("Logout request failed:", error);
    } finally {
      setUser(null);
      router.push("/");
    }
  };

  if (!isAuthenticated) return null;

  return (
    <header>
      <nav>
        <h1>Quant Dashboard</h1>
        <Link href="/portfolio">Portfolio</Link>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/asset-allocation">Asset Allocation</Link>
        <Link href="/dividends">Dividends</Link>
        <Link href="/settings">Settings</Link>
        <Link href="/stock-info">Stock Info</Link>
        <PortfolioScopeSelect />
        <button onClick={handleLogout} className="nav-logout-btn">
          Logout
        </button>
      </nav>
    </header>
  );
}

export default NavBar;
