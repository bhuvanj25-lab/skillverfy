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

export default function VerifiedWorkersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workers, setWorkers] = useState([]);

  const [skillFilter, setSkillFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data, error: qErr } = await supabase
          .from("workers")
          .select("id, full_name, primary_skill, score, verified, created_at")
          .eq("verified", true)
          .gte("score", 70)
          .order("score", { ascending: false })
          .limit(200);

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
      if (s && !String(w.full_name || "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [workers, skillFilter, search]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="text-sm font-semibold">
            SkillVerify
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/company/browse"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Company Browse
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
              Verified Worker Profiles
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Browse workers who scored 70+ in SkillVerify interviews.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:w-[32rem]">
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Filter by skill
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
                Search by name
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
            <div className="mt-1 text-xs text-rose-700">
              If this is a permissions error, run the updated SQL in
              `supabase/schema.sql` to enable public reads for verified workers.
            </div>
          </div>
        )}

        <div className="mt-8">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              Loading verified workers…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              No verified workers match your filters yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((w) => (
                <WorkerCard key={w.id} worker={w} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function WorkerCard({ worker }) {
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
          title={`Score: ${worker.score}/100`}
        >
          {badge.label}
          <span className="text-[11px] font-bold tabular-nums">
            {worker.score}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Verified via SkillVerify interview
        </div>
        <Link
          to="/company/browse"
          className="text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          Contact
        </Link>
      </div>
    </div>
  );
}

