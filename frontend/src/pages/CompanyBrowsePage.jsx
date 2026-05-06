import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { badgeClassName, getScoreBadge } from "../lib/badges.js";

const SKILLS = [
  "All",
  "Web Development",
  "Python",
  "Data Science",
  "Digital Marketing",
  "UI/UX Design",
  "Content Writing",
  "Sales",
  "Accounting"
];

async function apiPost(path, body) {
  const resp = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(json?.error || `Request failed (${resp.status})`);
  }
  return json;
}

export default function CompanyBrowsePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workers, setWorkers] = useState([]);

  const [skillFilter, setSkillFilter] = useState("All");
  const [minScore, setMinScore] = useState(70);
  const [maxScore, setMaxScore] = useState(100);
  const [search, setSearch] = useState("");

  const [contactingWorker, setContactingWorker] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data, error: qErr } = await supabase
          .from("workers")
          .select("id, full_name, primary_skill, score, verified")
          .eq("verified", true)
          .gte("score", 70)
          .order("score", { ascending: false })
          .limit(500);

        if (qErr) throw qErr;
        if (mounted) setWorkers(data || []);
      } catch (e) {
        if (mounted) setError(e?.message || "Failed to load workers.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return workers.filter((w) => {
      if (skillFilter !== "All" && w.primary_skill !== skillFilter) return false;
      const score = Number(w.score ?? 0);
      if (score < minScore || score > maxScore) return false;
      if (s && !String(w.full_name || "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [workers, skillFilter, minScore, maxScore, search]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="text-sm font-semibold">
            SkillVerify
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/workers/verified"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Verified profiles
            </Link>
            <Link
              to="/admin"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Company Browse
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Find verified workers, filter by skill and score, then request
              contact.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Skill
              </label>
              <select
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
              >
                {SKILLS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Min score
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Max score
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Search name
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. Aisha"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        <div className="mt-8">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              Loading verified workers…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              No workers match your filters.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((w) => (
                <CompanyWorkerCard
                  key={w.id}
                  worker={w}
                  onContact={() => setContactingWorker(w)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {contactingWorker && (
        <ContactModal
          worker={contactingWorker}
          onClose={() => setContactingWorker(null)}
          onSubmit={async (payload) => {
            await apiPost("/api/contact/request", payload);
          }}
        />
      )}
    </div>
  );
}

function CompanyWorkerCard({ worker, onContact }) {
  const badge = getScoreBadge(worker.score);
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">
            {worker.full_name}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {worker.primary_skill}
          </div>
        </div>
        <div
          className={[
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
            badgeClassName(badge.tone)
          ].join(" ")}
        >
          {badge.label}
          <span className="text-[11px] font-bold tabular-nums">
            {worker.score}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onContact}
        className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
      >
        Contact worker
      </button>
    </div>
  );
}

function ContactModal({ worker, onClose, onSubmit }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    companyName: "",
    companyEmail: "",
    message: ""
  });

  function validateEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.companyName.trim()) return setError("Company name is required.");
    if (!validateEmail(form.companyEmail))
      return setError("Enter a valid company email.");
    if (form.message.trim().length < 10)
      return setError("Message must be at least 10 characters.");

    setLoading(true);
    try {
      await onSubmit({
        workerId: worker.id,
        companyName: form.companyName.trim(),
        companyEmail: form.companyEmail.trim(),
        message: form.message.trim()
      });
      setDone(true);
    } catch (e2) {
      setError(e2?.message || "Failed to submit contact request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Contact request
            </div>
            <div className="mt-1 text-sm text-slate-600">
              To: <span className="font-medium">{worker.full_name}</span> •{" "}
              {worker.primary_skill}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {done ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Request sent. We’ll notify the worker and share contact if they
            accept.
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Company name
              </label>
              <input
                value={form.companyName}
                onChange={(e) =>
                  setForm((s) => ({ ...s, companyName: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Company email
              </label>
              <input
                type="email"
                value={form.companyEmail}
                onChange={(e) =>
                  setForm((s) => ({ ...s, companyEmail: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Message
              </label>
              <textarea
                value={form.message}
                onChange={(e) =>
                  setForm((s) => ({ ...s, message: e.target.value }))
                }
                rows={4}
                className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send request"}
            </button>
            <p className="text-xs text-slate-500">
              This sends a request record (no worker phone/email is exposed on
              the browse page).
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

