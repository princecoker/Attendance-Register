"use client";
import { useState } from "react";
import { GraduationCap, ArrowRight } from "lucide-react";
export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="min-h-screen flex items-center justify-center p-6 border-t-4 border-lagos-green">
      <div className="card w-full max-w-md p-9">
        <GraduationCap className="text-lagos-green mb-6" size={40} />
        <p className="text-xs font-bold tracking-widest text-lagos-green">
          CLASSLEDGER · LAGOS
        </p>
        <h1 className="text-3xl font-bold mt-3">Welcome back.</h1>
        <p className="text-slate-500 mt-3 mb-8">
          Sign in to manage your classes and attendance.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const password = new FormData(e.currentTarget).get("password");
              const r = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.error);
              window.location.href = "/";
            } catch (e) {
              setError(e instanceof Error ? e.message : "Sign in failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="label" htmlFor="password">
            Administrator password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="field"
            required
          />
          {error && (
            <p role="alert" className="text-red-700 text-sm mt-4">
              {error}
            </p>
          )}
          <button className="primary w-full mt-5" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
            <ArrowRight size={16} />
          </button>
        </form>
        <div className="flex mt-8 h-1 rounded overflow-hidden">
          <span className="bg-lagos-green w-1/4" />
          <span className="bg-lagos-yellow w-1/4" />
          <span className="bg-lagos-red w-1/4" />
          <span className="bg-lagos-blue w-1/4" />
        </div>
        <p className="mt-5 text-xs text-slate-400">
          School attendance & curriculum tracking
        </p>
      </div>
    </main>
  );
}
