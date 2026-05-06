import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";

const SKILLS = [
  "Web Development",
  "Python",
  "Data Science",
  "Digital Marketing",
  "UI/UX Design",
  "Content Writing",
  "Sales",
  "Accounting"
];

function normalizePhoneE164(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("+")) return s.replace(/\s+/g, "");
  // Default: assume India if user typed 10 digits
  const digits = s.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return s;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? "").trim());
}

function isValidUrl(url) {
  try {
    // Allow empty (optional)
    if (!String(url ?? "").trim()) return true;
    const u = new URL(String(url).trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function scoreLabel(score) {
  if (score === 100) return "Master";
  if (score >= 90) return "Expert";
  if (score >= 80) return "Skilled";
  if (score >= 70) return "Verified";
  return "Unverified";
}

export default function WorkerSignupPage() {
  const [step, setStep] = useState("details"); // details | otp | done
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    primarySkill: "Web Development",
    yearsExperience: "",
    portfolioLink: ""
  });

  const normalizedPhone = useMemo(
    () => normalizePhoneE164(form.phone),
    [form.phone]
  );

  const [otp, setOtp] = useState("");
  const [sessionUserId, setSessionUserId] = useState(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      const uid = data?.session?.user?.id ?? null;
      if (mounted) setSessionUserId(uid);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const validationErrors = useMemo(() => {
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = "Full name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!isValidEmail(form.email)) errs.email = "Enter a valid email.";

    if (!form.phone.trim()) errs.phone = "Phone number is required.";
    else {
      const e164 = normalizePhoneE164(form.phone);
      if (!/^\+\d{11,15}$/.test(e164)) {
        errs.phone =
          "Enter a valid phone (E.164). Example: +14155552671 or 10 digits (India).";
      }
    }

    if (!form.primarySkill) errs.primarySkill = "Select a primary skill.";

    const years = Number(form.yearsExperience);
    if (String(form.yearsExperience).trim() === "") {
      errs.yearsExperience = "Years of experience is required.";
    } else if (!Number.isFinite(years) || years < 0 || years > 60) {
      errs.yearsExperience = "Enter years between 0 and 60.";
    }

    if (!isValidUrl(form.portfolioLink)) {
      errs.portfolioLink = "Portfolio link must be a valid URL (https://...).";
    }

    return errs;
  }, [form]);

  const canSubmitDetails = Object.keys(validationErrors).length === 0;

  async function checkPhoneAlreadyUsed(phoneE164) {
    // Profile-level uniqueness check (fast UX). DB unique index is the real enforcement.
    const { data, error: qErr } = await supabase
      .from("workers")
      .select("phone")
      .eq("phone", phoneE164)
      .maybeSingle();

    if (qErr) {
      // If RLS blocks this (likely), we don't rely on it.
      return { used: false, blocked: true };
    }
    return { used: !!data, blocked: false };
  }

  async function handleSendOtp(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!canSubmitDetails) {
      setError("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    try {
      const phoneE164 = normalizedPhone;

      const phoneCheck = await checkPhoneAlreadyUsed(phoneE164);
      if (phoneCheck.used) {
        setError("This phone number already has an account. Please sign in.");
        return;
      }

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        phone: phoneE164
      });

      if (otpErr) {
        // Supabase will also enforce unique phone at Auth layer
        const msg = otpErr.message || "Failed to send OTP.";
        if (/already/i.test(msg) && /phone/i.test(msg)) {
          setError("This phone number already has an account. Please sign in.");
        } else {
          setError(msg);
        }
        return;
      }

      setStep("otp");
      setInfo(`OTP sent to ${phoneE164}.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    const code = String(otp ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      const phoneE164 = normalizedPhone;

      const { data, error: vErr } = await supabase.auth.verifyOtp({
        phone: phoneE164,
        token: code,
        type: "sms"
      });

      if (vErr) {
        setError(vErr.message || "OTP verification failed.");
        return;
      }

      const uid = data?.user?.id;
      if (!uid) {
        setError("Signed in but missing user id. Please try again.");
        return;
      }

      // Create worker profile row (id = auth.users.id)
      const payload = {
        id: uid,
        full_name: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: phoneE164,
        primary_skill: form.primarySkill,
        years_experience: Number(form.yearsExperience),
        portfolio_link: form.portfolioLink.trim() || null
      };

      const { error: upsertErr } = await supabase
        .from("workers")
        .upsert(payload, { onConflict: "id" });

      if (upsertErr) {
        // If unique index on phone/email triggers, show friendly message.
        const msg = upsertErr.message || "Could not save worker profile.";
        if (/workers_phone_unique/i.test(msg) || /duplicate key/i.test(msg)) {
          setError("This phone number already has an account. Please sign in.");
        } else {
          setError(msg);
        }
        return;
      }

      setStep("done");
      setInfo("Signup complete. Next: start your skill verification.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="text-sm font-semibold text-slate-900">
          SkillVerify
        </Link>
        <div className="text-sm text-slate-600">
          {sessionUserId ? (
            <span>
              Signed in:{" "}
              <span className="font-medium text-slate-900">
                {sessionUserId.slice(0, 8)}…
              </span>
            </span>
          ) : (
            <span>Not signed in</span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight">
            Worker Signup
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Create your account and verify your phone via OTP.
          </p>

          {(error || info) && (
            <div
              className={[
                "mt-6 rounded-2xl border px-4 py-3 text-sm",
                error
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-brand-200 bg-brand-50 text-brand-800"
              ].join(" ")}
            >
              {error || info}
            </div>
          )}

          {step === "details" && (
            <form className="mt-6 space-y-5" onSubmit={handleSendOtp}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Full Name"
                  value={form.fullName}
                  onChange={(v) => setForm((s) => ({ ...s, fullName: v }))}
                  placeholder="e.g. Aisha Khan"
                  error={validationErrors.fullName}
                />
                <Field
                  label="Email"
                  value={form.email}
                  onChange={(v) => setForm((s) => ({ ...s, email: v }))}
                  placeholder="e.g. aisha@email.com"
                  type="email"
                  error={validationErrors.email}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Phone Number (OTP)"
                  value={form.phone}
                  onChange={(v) => setForm((s) => ({ ...s, phone: v }))}
                  placeholder="e.g. +14155552671 or 9876543210"
                  error={validationErrors.phone}
                  hint={
                    normalizedPhone && /^\+\d{11,15}$/.test(normalizedPhone)
                      ? `Will use: ${normalizedPhone}`
                      : undefined
                  }
                />

                <Select
                  label="Primary Skill"
                  value={form.primarySkill}
                  onChange={(v) => setForm((s) => ({ ...s, primarySkill: v }))}
                  options={SKILLS}
                  error={validationErrors.primarySkill}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Years of Experience"
                  value={form.yearsExperience}
                  onChange={(v) => setForm((s) => ({ ...s, yearsExperience: v }))}
                  placeholder="e.g. 2"
                  inputMode="numeric"
                  error={validationErrors.yearsExperience}
                />
                <Field
                  label="Portfolio Link (optional)"
                  value={form.portfolioLink}
                  onChange={(v) => setForm((s) => ({ ...s, portfolioLink: v }))}
                  placeholder="https://..."
                  error={validationErrors.portfolioLink}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !canSubmitDetails}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Sending OTP..." : "Send OTP"}
                </button>
                <p className="mt-3 text-xs text-slate-500">
                  We’ll use OTP to enforce one account per phone number.
                </p>
              </div>
            </form>
          )}

          {step === "otp" && (
            <form className="mt-6 space-y-5" onSubmit={handleVerifyOtp}>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">
                  OTP Verification
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Enter the 6-digit code sent to{" "}
                  <span className="font-medium text-slate-900">
                    {normalizedPhone}
                  </span>
                  .
                </div>
              </div>

              <Field
                label="6-digit OTP"
                value={otp}
                onChange={(v) => setOtp(v.replace(/[^\d]/g, "").slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
              />

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Verifying..." : "Verify & Create Account"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setStep("details");
                    setOtp("");
                    setError("");
                    setInfo("");
                  }}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Edit details
                </button>
              </div>
            </form>
          )}

          {step === "done" && (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
                <div className="text-sm font-semibold text-brand-900">
                  Account created
                </div>
                <div className="mt-1 text-sm text-brand-800">
                  You’re ready to start your AI interview and skills test.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-sm font-semibold text-slate-900">
                  Status preview
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Current badge:{" "}
                  <span className="font-semibold text-slate-900">
                    {scoreLabel(0)}
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Next, we’ll build the AI Interview page and scoring.
                </p>
              </div>

              <Link
                to="/"
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Back to Home
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  error,
  hint
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-900">{label}</label>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={[
          "mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm shadow-sm outline-none transition",
          error
            ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-200"
            : "border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
        ].join(" ")}
      />
      {hint && !error && <div className="mt-2 text-xs text-slate-500">{hint}</div>}
      {error && <div className="mt-2 text-xs font-medium text-red-700">{error}</div>}
    </div>
  );
}

function Select({ label, value, onChange, options, error }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-900">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={[
          "mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm shadow-sm outline-none transition",
          error
            ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-200"
            : "border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
        ].join(" ")}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error && <div className="mt-2 text-xs font-medium text-red-700">{error}</div>}
    </div>
  );
}

