"use client";

import { FormEvent, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  User,
} from "lucide-react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const DEMO_ID = "uct123";
    const DEMO_PASSWORD = "uct@123";
if (
  userId.trim() === DEMO_ID &&
  password === DEMO_PASSWORD
) {
  setError("");

  window.location.href = "/dashboard";

  return;
}

    setError("Invalid ID or password.");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_35%)]" />
      </div>

      {/* Main */}
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">

          {/* Brand */}
          <div className="mb-7 text-center">
            {/* Temporary UCT Logo */}
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-600/10 shadow-lg shadow-blue-900/20">
              <span className="text-xl font-bold tracking-tight text-blue-400">
                UCT
              </span>
            </div>

            <h1 className="text-lg font-semibold tracking-tight text-white">
              UniConverge Technologies
            </h1>

            <p className="mt-1 text-xs text-slate-500">
              Internal Lead Research Portal
            </p>
          </div>

          {/* Login Card */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl shadow-black/30 backdrop-blur-xl">

            {/* Card Header */}
            <div className="border-b border-slate-800 px-6 py-5">
              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
                  <ShieldCheck
                    size={17}
                    className="text-blue-400"
                  />
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Admin Sign In
                  </h2>

                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Access your research workspace
                  </p>
                </div>

              </div>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="space-y-4 px-6 py-6"
            >

              {/* User ID */}
              <div>
                <label
                  htmlFor="userId"
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                >
                  User ID
                </label>

                <div className="relative">
                  <User
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                  />

                  <input
                    id="userId"
                    type="text"
                    value={userId}
                    onChange={(event) => {
                      setUserId(event.target.value);
                      setError("");
                    }}
                    placeholder="Enter your user ID"
                    required
                    autoComplete="username"
                    className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                >
                  Password
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                  />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    className={`h-11 w-full rounded-xl border bg-slate-950 pl-10 pr-10 text-sm text-slate-200 outline-none transition placeholder:text-slate-700 focus:ring-2 ${
                      error
                        ? "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/10"
                        : "border-slate-800 focus:border-blue-500/60 focus:ring-blue-500/10"
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 transition hover:text-slate-300"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                  <p className="text-xs text-red-400">
                    {error}
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 active:scale-[0.99]"
              >
                Sign In

                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </button>
            </form>

            {/* Security Footer */}
            <div className="border-t border-slate-800 bg-slate-950/40 px-6 py-4">
              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600">
                <LockKeyhole size={12} />

                <span>
                  Authorized UCT personnel only
                </span>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <p className="mt-5 text-center text-[10px] text-slate-700">
            © {new Date().getFullYear()} UniConverge Technologies
          </p>
        </div>
      </div>
    </main>
  );
}