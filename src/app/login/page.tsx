"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Login failed");
      const next = params.get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-card" onSubmit={submit}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/flotek-logo.svg" alt="Flotek" />
      <div className="eyebrow">Tender Radar</div>
      <h1 style={{ fontSize: 22, margin: "4px 0 18px" }}>
        Sign in<span className="dot">.</span>
      </h1>
      <label className="fld">
        <span className="eyebrow">Username</span>
        <input type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label className="fld">
        <span className="eyebrow">Password</span>
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>Internal Flotek system. Credentials are set in the Vercel environment variables.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
