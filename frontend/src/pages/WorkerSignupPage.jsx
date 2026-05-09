import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";

const SKILLS = ["Web Development","Python","Data Science","Digital Marketing","UI/UX Design","Content Writing","Sales","Accounting"];

export default function WorkerSignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState("details");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [otp, setOtp] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    primarySkill: "Web Development",
    yearsExperience: ""
  });

  async function handleSendOtp(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!form.fullName.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setLoading(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: form.email.trim().toLowerCase(),
        options: { shouldCreateUser: true }
      });
      if (otpErr) {
        setError(otpErr.message);
        return;
      }
      setStep("otp");
      setInfo("OTP sent to " + form.email);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (otp.trim().length < 6) {
      setError("Enter the OTP code from your email.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: vErr } = await supabase.auth.verifyOtp({
        email: form.email.trim().toLowerCase(),
        token: otp.trim(),
        type: "email"
      });
      if (vErr) {
        setError(vErr.message);
        return;
      }
      const uid = data?.user?.id;
      if (!uid) {
        setError("Missing user id. Try again.");
        return;
      }
      const { error: upsertErr } = await supabase.from("workers").upsert({
        id: uid,
        full_name: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        primary_skill: form.primarySkill,
        years_experience: Number(form.yearsExperience) || 0
      }, { onConflict: "id" });
      if (upsertErr) {
        setError(upsertErr.message);
        return;
      }
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="text-sm font-semibold">SkillVerify</Link>
      </header>
      <main className="mx-auto max-w-xl px-6 pb-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Worker Signup</h1>
          <p className="mt-2 text-sm text-slate-600">Verify your email to create your account.</p>

          {(error || info) && (
            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>
              {error || info}
            </div>
          )}

          {step === "details" && (
            <form className="mt-6 space-y-4" onSubmit={handleSendOtp}>
              <div>
                <label className="text-sm font-medium">Full Name *</label>
                <input
                  value={form.fullName}
                  onChange={e => setForm(s => ({...s, fullName: e.target.value}))}
                  placeholder="Your full name"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(s => ({...s, email: e.target.value}))}
                  placeholder="your@email.com"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Primary Skill</label>
                <select
                  value={form.primarySkill}
                  onChange={e => setForm(s => ({...s, primarySkill: e.target.value}))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                >
                  {SKILLS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Years of Experience</label>
                <input
                  value={form.yearsExperience}
                  onChange={e => setForm(s => ({...s, yearsExperience: e.target.value}))}
                  placeholder="e.g. 2"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {loading ? "Sending OTP..." : "Send OTP to Email →"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form className="mt-6 space-y-4" onSubmit={handleVerifyOtp}>
              <p className="text-sm text-slate-600">Enter the code sent to <strong>{form.email}</strong></p>
              <input
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
                placeholder="Enter OTP code"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Create Account →"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("details"); setOtp(""); setError(""); }}
                className="w-full rounded-xl border py-3 text-sm font-semibold text-slate-700"
              >
                Go Back
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
                ✅ Account created successfully!
              </div>
              <button
                onClick={() => navigate("/worker/interview")}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Start AI Interview →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}