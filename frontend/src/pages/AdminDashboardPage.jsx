import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { badgeClassName, getScoreBadge } from "../lib/badges.js";

async function apiGet(path, adminKey) {
  const resp = await fetch(path, {
    method: "GET",
    headers: {
      "x-admin-key": adminKey
    }
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(json?.error || `Request failed (${resp.status})`);
  }
  return json;
}

function passFailLabel(w) {
  const score = Number(w.score ?? 0);
  if (score >= 70) return "PASS";
  return "FAIL";
}

export default function AdminDashboardPage() {
  const [adminKey, setAdminKey] = useState(() => {
    try {
      return localStorage.getItem("skillverify_admin_key") || "";
    } catch {
      return "";
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [workers, setWorkers] = useState([]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet("/api/admin/workers", adminKey);
      setWorkers(data.workers || []);
    } catch (e) {
      setError(e?.message || "Failed to load workers.");
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!adminKey) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const total = workers.length;
    const verified = workers.filter((w) => !!w.verified).length;
    const pass = workers.filter((w) => Number(w.score ?? 0) >= 70).length;
    const fail = workers.filter((w) => Number(w.score ?? 0) < 70).length;
    const retryLocked = workers.filter((w) => {
      if (!w.failed_until) return false;
      const t = new Date(w.failed_until).getTime();
      return Number.isFinite(t) && t > Date.now();
    }).length;
    return { total, verified, pass, fail, retryLocked };
  }, [workers]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
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
              to="/company/browse"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Company browse
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Overview of all workers, scores, status, and flags.
            </p>
          </div>

          <div className="w-full max-w-md">
            <label className="text-xs font-semibold text-slate-700">
              Admin key
            </label>
            <div className="mt-2 flex gap-2">
              <input
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Set ADMIN_KEY in Vercel env, paste here"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
              />
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem("skillverify_admin_key", adminKey);
                  } catch {
                    // ignore
                  }
                  load();
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Load
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              This page calls `GET /api/admin/workers` which requires header
              `x-admin-key` matching server env `ADMIN_KEY`.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Total workers" value={totals.total} />
          <Stat label="Verified=true" value={totals.verified} />
          <Stat label="Pass (≥70)" value={totals.pass} />
          <Stat label="Fail (<70)" value={totals.fail} />
          <Stat label="Retry locked" value={totals.retryLocked} />
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="text-sm font-semibold text-slate-900">
              Workers table
            </div>
            {loading && (
              <div className="text-xs font-medium text-slate-500">
                Loading…
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Skill</th>
                  <th className="px-5 py-3">Score</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Verified</th>
                  <th className="px-5 py-3">Retry</th>
                  <th className="px-5 py-3">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {workers.map((w) => (
                  <WorkerRow key={w.id} w={w} />
                ))}
                {(!loading && workers.length === 0) && (
                  <tr>
                    <td className="px-5 py-6 text-sm text-slate-600" colSpan={7}>
                      No data loaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
        {value}
      </div>
    </div>
  );
}

function WorkerRow({ w }) {
  const badge = getScoreBadge(w.score);
  const status = passFailLabel(w);
  const retryLocked =
    w.failed_until && new Date(w.failed_until).getTime() > Date.now();

  const flagsCount = Array.isArray(w.suspicious_flags)
    ? w.suspicious_flags.length
    : typeof w.suspicious_flags === "string"
      ? 1
      : 0;

  return (
    <tr className="align-top">
      <td className="px-5 py-4">
        <div className="font-semibold text-slate-900">{w.full_name}</div>
        <div className="mt-1 text-xs text-slate-500">{w.email}</div>
      </td>
      <td className="px-5 py-4 text-slate-700">{w.primary_skill}</td>
      <td className="px-5 py-4">
        <span
          className={[
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
            badgeClassName(badge.tone)
          ].join(" ")}
        >
          {badge.label}
          <span className="text-[11px] font-bold tabular-nums">{w.score}</span>
        </span>
      </td>
      <td className="px-5 py-4">
        <span
          className={[
            "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
            status === "PASS"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          ].join(" ")}
        >
          {status}
        </span>
      </td>
      <td className="px-5 py-4 text-slate-700">{w.verified ? "true" : "false"}</td>
      <td className="px-5 py-4 text-slate-700">
        {retryLocked ? (
          <span className="text-xs text-amber-700">
            Locked until {new Date(w.failed_until).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-xs text-slate-500">—</span>
        )}
      </td>
      <td className="px-5 py-4 text-slate-700">
        {flagsCount > 0 ? (
          <span className="text-xs font-semibold text-amber-700">
            {flagsCount} flag(s)
          </span>
        ) : (
          <span className="text-xs text-slate-500">None</span>
        )}
      </td>
    </tr>
  );
}

