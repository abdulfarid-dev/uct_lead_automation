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

    if (userId.trim() === DEMO_ID && password === DEMO_PASSWORD) {
      setError("");
      window.location.href = "/dashboard";
      return;
    }

    setError("Invalid ID or password.");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* =====================================================
          BACKGROUND
      ====================================================== */}
     {/* Background */}
<div className="pointer-events-none absolute inset-0 overflow-hidden">

  {/* UCT Background Watermark */}
  <img
    src="/logo.png"
    alt=""
    aria-hidden="true"
    className="absolute left-1/2 top-1/2 z-0 w-[1300px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.08] brightness-0 invert"
  />

  {/* Blue Glow */}
  <div className="absolute -left-40 -top-40 z-10 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />

  {/* Cyan Glow */}
  <div className="absolute -bottom-40 -right-40 z-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

  {/* Radial Gradient */}
  <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_35%)]" />

</div>

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">

          {/* =================================================
              UCT BRAND
          ================================================== */}
          <div className="mb-9 text-center">
            <img
              src="/logo.png"
              alt="UniConverge Technologies"
              className="mx-auto h-28 w-auto max-w-[320px] object-contain"
            />

            <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Internal Lead Research Portal
            </p>
          </div>

          {/* =================================================
              LOGIN CARD
          ================================================== */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl shadow-black/30 backdrop-blur-xl">

            {/* Card Header */}
            <div className="border-b border-slate-800 px-6 py-5">
              <div className="flex items-center gap-3">

                {/* Security Icon */}
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
                  <ShieldCheck
                    size={17}
                    className="text-blue-400"
                  />
                </div>

                {/* Header Text */}
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

            {/* =================================================
                LOGIN FORM
            ================================================== */}
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
                  {/* User Icon */}
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

                  {/* Lock Icon */}
                  <LockKeyhole
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                  />

                  {/* Password Input */}
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

                  {/* Show / Hide Password */}
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

              {/* Error Message */}
              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                  <p className="text-xs text-red-400">
                    {error}
                  </p>
                </div>
              )}

              {/* Sign In Button */}
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

            {/* =================================================
                SECURITY FOOTER
            ================================================== */}
            <div className="border-t border-slate-800 bg-slate-950/40 px-6 py-4">
              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600">
                <LockKeyhole size={12} />

                <span>
                  Authorized UCT personnel only
                </span>
              </div>
            </div>
          </div>

          {/* =================================================
              COPYRIGHT
          ================================================== */}
          <p className="mt-5 text-center text-[10px] text-slate-700">
            © {new Date().getFullYear()} UniConverge Technologies
          </p>

        </div>
      </div>
    </main>
  );
}