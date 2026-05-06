import { Link } from "react-router-dom";

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
        <span className="text-lg font-bold tracking-tight">SV</span>
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-slate-900">SkillVerify</div>
        <div className="text-xs text-slate-500">Skills-first hiring</div>
      </div>
    </div>
  );
}

function PrimaryButton({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
    >
      {children}
    </Link>
  );
}

function SecondaryButton({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center rounded-xl border border-brand-200 bg-white px-5 py-3 text-sm font-semibold text-brand-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
    >
      {children}
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-12rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-brand-100 blur-3xl" />
          <div className="absolute bottom-[-14rem] right-[-10rem] h-[32rem] w-[32rem] rounded-full bg-brand-50 blur-3xl" />
        </div>

        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Logo />
          <div className="hidden items-center gap-3 sm:flex">
            <Link
              to="/company/browse"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Browse talent
            </Link>
            <Link
              to="/worker/signup"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Start verification
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/60 px-3 py-1 text-xs font-semibold text-brand-700 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-brand-600" />
                AI-led skill verification for global hiring
              </div>

              <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                Get Hired Globally
                <br />
                Based on Skills — Not Your Degree
              </h1>

              <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-600">
                SkillVerify helps workers prove real ability through structured AI
                interviews and practical tasks, so companies can hire confidently.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <PrimaryButton to="/worker/signup">I am a Worker</PrimaryButton>
                <SecondaryButton to="/company/browse">
                  I am a Company
                </SecondaryButton>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-4 sm:max-w-xl sm:grid-cols-4">
                {[
                  { label: "Fast", value: "5 questions" },
                  { label: "Fair", value: "Skills-first" },
                  { label: "Secure", value: "Anti-cheat" },
                  { label: "Global", value: "Remote-ready" }
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {item.label}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur sm:p-8">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">
                    Live skill signal
                  </div>
                  <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                    Verified-ready
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-8 w-8 shrink-0 rounded-full bg-brand-600" />
                    <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-slate-800">
                      Welcome! What primary skill are you verifying today?
                    </div>
                  </div>
                  <div className="flex items-start justify-end gap-3">
                    <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
                      Web Development
                    </div>
                    <div className="mt-1 h-8 w-8 shrink-0 rounded-full bg-slate-200" />
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-8 w-8 shrink-0 rounded-full bg-brand-600" />
                    <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-slate-800">
                      Great. Let’s start with fundamentals—explain how CORS works.
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  Interview chat preview (we’ll build the full test next)
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

