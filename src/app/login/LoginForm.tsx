"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Spinner } from "@/components/Icons";
import { LANGUAGES } from "@/lib/config";
import { api } from "@/lib/client";

export function LoginForm({ allowSignup, next }: { allowSignup: boolean; next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mosaic.lang");
      if (saved) setLanguage(saved);
    } catch {
      /* ignore */
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(mode === "signin" ? "/api/auth/login" : "/api/auth/signup", { method: "POST", json: { email, password, name, language } });
      router.replace(next && next.startsWith("/") ? next : "/projects");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-[400px] flex flex-col gap-[22px]">
      <div className="flex flex-col gap-2">
        <h1 id="h-signin" className="m-0 font-display font-normal text-[40px] tracking-[-0.01em]">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="m-0 text-[15px] text-muted leading-[1.5]">
          {mode === "signin" ? "Sign in with the email and password your Mosaic admin gave you." : "A few details and you're in."}
        </p>
      </div>

      {allowSignup && (
        <div className="inline-flex self-start border border-line rounded-full overflow-hidden bg-white">
          <button type="button" onClick={() => setMode("signin")} className="border-0 text-[13px] font-bold" style={{ padding: "9px 18px", background: mode === "signin" ? "#1E2430" : "transparent", color: mode === "signin" ? "#fff" : "#1E2430", font: "inherit", fontWeight: mode === "signin" ? 700 : 600, fontSize: 13 }}>
            Sign in
          </button>
          <button type="button" onClick={() => setMode("signup")} className="border-0 text-[13px]" style={{ padding: "9px 18px", background: mode === "signup" ? "#1E2430" : "transparent", color: mode === "signup" ? "#fff" : "#1E2430", font: "inherit", fontWeight: mode === "signup" ? 700 : 600, fontSize: 13 }}>
            Create account
          </button>
        </div>
      )}

      {mode === "signup" && (
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-[13px] font-bold text-muted">
            Your name
          </label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Asha Raman" autoComplete="name" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-[13px] font-bold text-muted">
          Email
        </label>
        <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-[13px] font-bold text-muted">
          Password
        </label>
        <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="lang" className="text-[13px] font-bold text-muted">
          Language you&apos;ll talk to Mosaic in
        </label>
        <select id="lang" className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">You can speak in any language later — this just sets how Mosaic talks to you.</span>
      </div>

      {error && (
        <p role="alert" className="m-0 text-sm font-semibold rounded-xl px-3.5 py-2.5" style={{ background: "#FBF1EA", color: "#9A4A26" }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-primary" style={{ height: 54, boxShadow: "var(--shadow-cta)" }}>
        {busy ? <Spinner light /> : null}
        {mode === "signin" ? "Sign in" : "Create account"}
        {!busy && <ArrowRight size={16} />}
      </button>

      <p className="m-0 text-xs text-muted leading-[1.5]">
        Your resume, voice notes and anything Mosaic finds online stay private to you. Nothing is published unless you share a link.
      </p>
    </form>
  );
}
