"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/report", label: "Build report" },
  { href: "/reports", label: "Report history" },
  { href: "/sources", label: "Sources" },
  { href: "/settings", label: "Settings" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }
  return (
    <>
      <header className="masthead">
        <div className="wrap bar">
          <Link href="/" className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/flotek-logo.svg" alt="Flotek" />
            <span>Tender Radar</span>
          </Link>
        </div>
        <div className="navbar">
          <nav className="wrap nav">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={path === n.href || (n.href !== "/" && path.startsWith(n.href) && !(n.href === "/report" && path.startsWith("/reports"))) ? "active" : ""}>
                {n.label}
              </Link>
            ))}
            <button onClick={logout}>Log out</button>
          </nav>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer className="wrap" style={{ padding: "30px 24px 40px", fontSize: 11, color: "var(--muted-soft)" }}>
        Flotek Tender Radar · Internal use · Every figure shown comes from the published procurement data; nothing is inferred by AI.
      </footer>
    </>
  );
}
