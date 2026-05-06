import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";

const QUESTION_TIME_SECONDS = 90;
const TOTAL_QUESTIONS = 5;

async function apiPost(path, body) {
  const resp = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = json?.error || `Request failed (${resp.status})`;
    const e = new Error(err);
    e.payload = json;
    throw e;
  }
  return json;
}

export default function AiInterviewPage() {
  const [skill, setSkill] = useState("Web Development");
  const [workerId, setWorkerId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [starting, setStarting] = useState(true);

  const [messages, setMessages] = useState(() => [
    {
      id: "intro",
      role: "ai",
      text: `Preparing your interview...`,
      meta: "system"
    }
  ]);

  const [currentIndex, setCurrentIndex] = useState(0); // 0-based UI index
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_TIME_SECONDS);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("in_progress"); // in_progress | finished | terminated
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [tabWarning, setTabWarning] = useState("");
  const [codeAnswer, setCodeAnswer] = useState("");
  const [scoreInfo, setScoreInfo] = useState({ lastScore: null, totalScore: 0 });

  const timerRef = useRef(null);
  const chatEndRef = useRef(null);

  // Load worker + skill from Supabase profile, then start session via backend
  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setStarting(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess?.session?.user?.id;
        if (!uid) {
          setStatus("terminated");
          setMessages((prev) => [
            ...prev,
            {
              id: "auth-required",
              role: "ai",
              text: "Please sign in before starting the interview.",
              meta: "system"
            }
          ]);
          return;
        }

        if (!mounted) return;
        setWorkerId(uid);

        // Fetch worker profile to get their primary skill
        const { data: worker, error: wErr } = await supabase
          .from("workers")
          .select("primary_skill, failed_until")
          .eq("id", uid)
          .single();

        if (wErr || !worker) {
          setStatus("terminated");
          setMessages((prev) => [
            ...prev,
            {
              id: "profile-required",
              role: "ai",
              text: "Worker profile not found. Please complete signup first.",
              meta: "system"
            }
          ]);
          return;
        }

        if (worker.failed_until) {
          const until = new Date(worker.failed_until).getTime();
          if (!Number.isNaN(until) && until > Date.now()) {
            setStatus("terminated");
            setMessages((prev) => [
              ...prev,
              {
                id: "retry-locked",
                role: "ai",
                text: `You can retry after: ${new Date(worker.failed_until).toLocaleString()}`,
                meta: "system"
              }
            ]);
            return;
          }
        }

        const s = worker.primary_skill || "Web Development";
        setSkill(s);

        const start = await apiPost("/api/interview/start", {
          workerId: uid,
          skill: s
        });

        if (!mounted) return;
        setSessionId(start.sessionId);
        setCurrentIndex(0);
        setMessages([
          {
            id: "intro",
            role: "ai",
            text: `Welcome to your ${s} interview. Answer each question within 90 seconds.`,
            meta: "system"
          },
          {
            id: "q-0",
            role: "ai",
            text: start.text,
            meta: "question"
          }
        ]);
      } catch (e) {
        setStatus("terminated");
        setMessages((prev) => [
          ...prev,
          {
            id: "start-error",
            role: "ai",
            text: e?.message || "Failed to start interview.",
            meta: "system"
          }
        ]);
      } finally {
        if (mounted) setStarting(false);
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  // Countdown timer per question
  useEffect(() => {
    if (status !== "in_progress") return;
    if (starting) return;
    if (currentIndex >= TOTAL_QUESTIONS) return;

    setSecondsLeft(QUESTION_TIME_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Auto-submit on timeout
          handleSubmitAnswer("[Auto-submitted: time ran out]", true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, status]);

  // Right-click disabled only on this page
  useEffect(() => {
    function blockContextMenu(e) {
      e.preventDefault();
    }
    document.addEventListener("contextmenu", blockContextMenu);
    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
    };
  }, []);

  // Tab switch detection using Page Visibility API
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        setTabSwitchCount((prev) => {
          const next = prev + 1;
          if (next === 1) {
            setTabWarning(
              "Warning: Tab switch detected. Second time will end the test."
            );
          } else if (next >= 2) {
            setTabWarning("Test ended due to repeated tab switching.");
            setStatus("terminated");
            if (timerRef.current) clearInterval(timerRef.current);
          }
          return next;
        });
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function handleSubmitAnswer(textOverride, fromTimeout = false) {
    if (status !== "in_progress") return;
    if (starting) return;
    const trimmed = textOverride ?? answer.trim();
    if (!trimmed && !fromTimeout) return;
    if (!sessionId || !workerId) return;

    const questionId = `q-${currentIndex}`;
    const optimistic = [
      ...messages,
      {
        id: `${questionId}-answer`,
        role: "user",
        text: trimmed || "[No answer provided]",
        meta: "answer"
      }
    ];
    setMessages(optimistic);
    setAnswer("");

    try {
      const resp = await apiPost("/api/interview/answer", {
        sessionId,
        answer: trimmed || "[No answer provided]"
      });

      if (resp.type === "question") {
        setScoreInfo({ lastScore: resp.lastScore, totalScore: resp.totalScore });
        const nextIndex = currentIndex + 1;
        setMessages((prev) => [
          ...prev,
          {
            id: `q-${nextIndex}`,
            role: "ai",
            text: resp.text,
            meta: "question"
          }
        ]);
        setCurrentIndex(nextIndex);
      } else if (resp.type === "final") {
        setScoreInfo({ lastScore: resp.lastScore, totalScore: resp.totalScore });
        setMessages((prev) => [
          ...prev,
          {
            id: `final-feedback`,
            role: "ai",
            text:
              `Final score: ${resp.totalScore}/100. ` +
              (resp.pass ? "Pass." : "Fail."),
            meta: "system"
          },
          {
            id: `coding-task`,
            role: "ai",
            text: `Coding task:\n${resp.codingTask}`,
            meta: "question"
          }
        ]);

        setCurrentIndex(TOTAL_QUESTIONS);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        throw new Error("Unexpected server response.");
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${questionId}-server-error`,
          role: "ai",
          text: e?.message || "Failed to submit answer.",
          meta: "system"
        }
      ]);
      setStatus("terminated");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    handleSubmitAnswer();
  }

  const showCodeEditor = currentIndex >= TOTAL_QUESTIONS;

  const timerPercent = useMemo(() => {
    if (status !== "in_progress" || currentIndex >= TOTAL_QUESTIONS)
      return 0;
    return (secondsLeft / QUESTION_TIME_SECONDS) * 100;
  }, [secondsLeft, status, currentIndex]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-50"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-xs font-bold">
                SV
              </span>
              <span>SkillVerify</span>
            </Link>
            <span className="mx-2 h-4 w-px bg-slate-700" />
            <span className="text-xs font-medium text-slate-400">
              AI Interview • {skill}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-300 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Anti-cheat active
            </div>
            <div className="hidden items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-slate-300 sm:flex">
              <span className="text-[11px] text-slate-500">Score</span>
              <span className="text-sm font-semibold tabular-nums">
                {scoreInfo.totalScore}/100
              </span>
            </div>
            {status === "in_progress" && currentIndex < TOTAL_QUESTIONS && (
              <div className="flex items-baseline gap-1 rounded-full bg-slate-900 px-3 py-1">
                <span className="text-[11px] uppercase tracking-wide text-slate-500">
                  Time
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  0:{secondsLeft.toString().padStart(2, "0")}
                </span>
              </div>
            )}
          </div>
        </div>

        {status === "in_progress" && currentIndex < TOTAL_QUESTIONS && (
          <div className="h-1 w-full bg-slate-900">
            <div
              className="h-1 bg-brand-500 transition-all"
              style={{ width: `${timerPercent}%` }}
            />
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
        {starting && (
          <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-300">
            Starting interview… (Claude)
          </div>
        )}
        {tabWarning && (
          <div className="mb-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            {tabWarning}
          </div>
        )}

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* Chat column */}
          <section className="flex min-h-[320px] flex-col rounded-3xl border border-slate-800 bg-slate-900/60 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-brand-600" />
                  <span className="absolute -right-0 -bottom-0 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-semibold text-slate-100">
                    SkillVerify AI
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Structured interview • {TOTAL_QUESTIONS} questions
                  </div>
                </div>
              </div>
              <div className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] text-slate-400">
                Question {Math.min(currentIndex + 1, TOTAL_QUESTIONS)}/
                {TOTAL_QUESTIONS}
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
              {messages.map((m) => (
                <ChatBubble key={m.id} role={m.role} text={m.text} />
              ))}
              <div ref={chatEndRef} />
            </div>

            {status === "in_progress" &&
              !starting &&
              currentIndex < TOTAL_QUESTIONS && (
              <form
                onSubmit={handleManualSubmit}
                className="border-t border-slate-800 bg-slate-900/80 px-3 py-3 sm:px-4"
              >
                <div className="flex items-end gap-2">
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    type="submit"
                    disabled={!answer.trim()}
                    className="inline-flex items-center justify-center rounded-2xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                  <span>Answers are auto-submitted when time runs out.</span>
                </div>
              </form>
            )}

            {status !== "in_progress" && (
              <div className="border-t border-slate-800 bg-slate-900/80 px-4 py-3 text-xs text-slate-400">
                {status === "terminated"
                  ? "Your interview has been terminated due to repeated tab switching."
                  : "Interview finished. We’ll compute your score next."}
              </div>
            )}
          </section>

          {/* Code editor column */}
          <section className="flex min-h-[260px] flex-col rounded-3xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold text-slate-100">
                  Live Code Task
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Paste disabled • Right click disabled
              </span>
            </div>

            {!showCodeEditor ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-xs text-slate-400">
                <p>
                  The coding exercise unlocks after you complete all{" "}
                  {TOTAL_QUESTIONS} interview questions.
                </p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col px-4 py-3">
                <p className="mb-2 text-xs text-slate-400">
                  Implement the required logic in the editor below. You cannot
                  paste code or use right click.
                </p>
                <div className="flex-1 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                  <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="ml-2 rounded border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                      editor.js
                    </span>
                  </div>
                  <textarea
                    value={codeAnswer}
                    onChange={(e) => setCodeAnswer(e.target.value)}
                    onPaste={(e) => {
                      e.preventDefault();
                    }}
                    onCopy={(e) => {
                      e.preventDefault();
                    }}
                    onCut={(e) => {
                      e.preventDefault();
                    }}
                    onKeyDown={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        const key = e.key.toLowerCase();
                        if (key === "v" || key === "c" || key === "x") {
                          e.preventDefault();
                        }
                      }
                    }}
                    spellCheck={false}
                    className="h-full w-full resize-none bg-transparent p-3 font-mono text-[12px] leading-relaxed text-slate-100 outline-none"
                    placeholder="// Write your solution here..."
                  />
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  We’ll analyze your final code together with your interview
                  answers to compute your skill score.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function ChatBubble({ role, text }) {
  const isAi = role === "ai";
  return (
    <div
      className={[
        "flex gap-2",
        isAi ? "justify-start" : "justify-end"
      ].join(" ")}
    >
      {isAi && (
        <div className="mt-4 h-7 w-7 shrink-0 rounded-full bg-brand-600" />
      )}
      <div
        className={[
          "max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm sm:px-4 sm:py-2.5",
          isAi
            ? "rounded-bl-sm bg-slate-800 text-slate-50"
            : "rounded-br-sm bg-brand-500 text-white"
        ].join(" ")}
      >
        {text}
      </div>
      {!isAi && (
        <div className="mt-4 h-7 w-7 shrink-0 rounded-full bg-slate-700" />
      )}
    </div>
  );
}

