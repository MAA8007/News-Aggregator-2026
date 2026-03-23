"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";

export default function AuthModal() {
  const { login, signup, closeAuthModal } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">("login");

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, [tab]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeAuthModal(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeAuthModal]);

  function reset() {
    setEmail(""); setPassword(""); setUsername(""); setError("");
  }

  async function handleSubmit() {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      if (tab === "login") {
        await login(email.trim(), password);
      } else {
        if (!username.trim()) { setError("Username is required."); setLoading(false); return; }
        await signup(username.trim(), email.trim(), password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) closeAuthModal(); }}
    >
      <div
        className="w-full max-w-sm border p-8"
        style={{ background: "var(--bg-base)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <h2
            className="text-2xl font-bold italic"
            style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}
          >
            {tab === "login" ? "Sign In" : "Create Account"}
          </h2>
          <button
            onClick={closeAuthModal}
            className="text-[9px] font-semibold tracking-[0.18em] uppercase hover:opacity-60 transition-opacity"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            esc
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 mb-6">
          {(["login", "signup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); reset(); }}
              className="px-3 py-1.5 text-[9px] font-semibold tracking-[0.18em] uppercase transition-all duration-150"
              style={{
                fontFamily: "Syne, sans-serif",
                color: tab === t ? "var(--accent)" : "var(--text-faint)",
                background: tab === t ? "var(--accent-dim)" : "transparent",
                borderRadius: "2px",
              }}
            >
              {t === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-4">
          {tab === "signup" && (
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[9px] tracking-[0.15em] uppercase"
                style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
              >
                Username
              </label>
              <input
                ref={tab === "signup" ? firstRef : undefined}
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                placeholder="yourname"
                className="w-full px-4 py-2.5 border bg-transparent outline-none text-sm"
                style={{ borderColor: "var(--border-hover)", color: "var(--text-primary)", fontFamily: "Syne, sans-serif" }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              className="text-[9px] tracking-[0.15em] uppercase"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
            >
              Email
            </label>
            <input
              ref={tab === "login" ? firstRef : undefined}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 border bg-transparent outline-none text-sm"
              style={{ borderColor: "var(--border-hover)", color: "var(--text-primary)", fontFamily: "Syne, sans-serif" }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              className="text-[9px] tracking-[0.15em] uppercase"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder={tab === "signup" ? "At least 6 characters" : "••••••••"}
              className="w-full px-4 py-2.5 border bg-transparent outline-none text-sm"
              style={{ borderColor: "var(--border-hover)", color: "var(--text-primary)", fontFamily: "Syne, sans-serif" }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <p
            className="mt-4 text-[9px] tracking-wide"
            style={{ fontFamily: "Syne, sans-serif", color: "#ff6b6b" }}
          >
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !email.trim() || !password.trim()}
          className="mt-6 w-full py-2.5 border text-[9px] font-semibold tracking-[0.18em] uppercase transition-all duration-200 disabled:opacity-40"
          style={{
            fontFamily: "Syne, sans-serif",
            borderColor: "var(--accent-border)",
            color: "var(--accent)",
            background: "var(--accent-dim)",
          }}
        >
          {loading ? "…" : tab === "login" ? "Sign In" : "Create Account"}
        </button>

        {/* Switch tab */}
        <p
          className="mt-4 text-center text-[9px]"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          {tab === "login" ? "No account? " : "Already have one? "}
          <button
            onClick={() => { setTab(tab === "login" ? "signup" : "login"); reset(); }}
            className="underline hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-muted)" }}
          >
            {tab === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
