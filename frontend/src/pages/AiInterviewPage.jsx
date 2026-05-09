import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";

export default function AiInterviewPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState("loading");
  const [worker, setWorker] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(120);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(2);
  const timerRef = useRef(null);

  useEffect(() => {
    loadWorker();
  }, []);

  async function loadWorker() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/worker/signup"); return; }

    const { data: w } = await supabase
      .from("workers")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!w) { navigate("/worker/signup"); return; }

    setWorker(w);
    const attempts = w.interview_attempts || 0;
    const left = 2 - attempts;
    setAttemptsLeft(left);

    if (left <= 0) {
      setStage("no_attempts");
    } else {
      setStage("intro");
    }
  }

  async function startInterview() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/interview/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: worker.primary_skill })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(""));
      setCurrentQ(0);
      setCurrentAnswer("");
      setTimeLeft(120);
      setStage("interview");
      startTimer();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startTimer() {
    clearInterval(timerRef.current);
    setTimeLeft(120);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleNextQuestion(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleNextQuestion(auto = false) {
    clearInterval(timerRef.current);
    const newAnswers = [...answers];
    newAnswers[currentQ] = currentAnswer;
    setAnswers(newAnswers);

    if (currentQ + 1 >= questions.length) {
      submitInterview(newAnswers);
    } else {
      setCurrentQ(prev => prev + 1);
      setCurrentAnswer("");
      setTimeLeft(120);
      startTimer();
    }
  }

  async function submitInterview(finalAnswers) {
    setStage("evaluating");
    try {
      const res = await fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill: worker.primary_skill,
          questions,
          answers: finalAnswers
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const newAttempts = (worker.interview_attempts || 0) + 1;
      const shouldUpdate = !worker.score || data.score > worker.score;

      await supabase.from("workers").update({
        interview_attempts: newAttempts,
        ...(shouldUpdate ? {
          score: data.score,
          badge: data.badge,
          verified: data.score >= 60,
          interview_feedback: data.feedback
        } : {})
      }).eq("id", worker.id);

      setResult(data);
      setStage("result");
    } catch (err) {
      setError(err.message);
      setStage("intro");
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    setError("Copy-paste is not allowed. Please type your answer.");
  }

  if (stage === "loading") return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-500">Loading...</p>
    </div>
  );

  if (stage === "no_attempts") return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-slate-900">No Attempts Left</h1>
        <p className="mt-2 text-slate-600">You have used both your interview attempts.</p>
        {worker?.score && (
          <div className="mt-4 p-4 bg-slate-50 rounded-xl">
            <p className="font-semibold">Your best score: <span className="text-slate-900">{worker.score}/100</span></p>
            <p className="text-slate-600">Badge: <span className="font-bold">{worker.badge}</span></p>
          </div>
        )}
        <button onClick={() => navigate("/")} className="mt-6 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white">
          Back to Home
        </button>
      </div>
    </div>
  );

  if (stage === "intro") return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-lg w-full">
        <div className="rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="text-4xl mb-4">🎯</div>
          <h1 className="text-2xl font-bold text-slate-900">AI Skill Interview</h1>
          <p className="mt-2 text-slate-600">Skill: <span className="font-semibold text-slate-900">{worker?.primary_skill}</span></p>

          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
              <span className="text-lg">📝</span>
              <p className="text-sm text-slate-700"><span className="font-semibold">10 questions</span> — 8 skill-specific, 1 achievement, 1 general</p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
              <span className="text-lg">⏱️</span>
              <p className="text-sm text-slate-700"><span className="font-semibold">2 minutes</span> per question</p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl">
              <span className="text-lg">🚫</span>
              <p className="text-sm text-red-700"><span className="font-semibold">No copy-paste</span> allowed — type all answers</p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl">
              <span className="text-lg">🎟️</span>
              <p className="text-sm text-amber-700"><span className="font-semibold">{attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining</span> — best score is kept</p>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <button
            onClick={startInterview}
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Generating questions..." : "Start Interview →"}
          </button>
        </div>
      </div>
    </div>
  );

  if (stage === "interview") return (
    <div className="min-h-screen bg-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm font-medium text-slate-500">
            Question {currentQ + 1} of {questions.length}
          </span>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${timeLeft <= 30 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
            ⏱️ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
          </span>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-2 mb-6">
          <div
            className="bg-slate-900 h-2 rounded-full transition-all"
            style={{ width: `${((currentQ) / questions.length) * 100}%` }}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 p-6 mb-4">
          <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
            {currentQ < 8 ? `${worker?.primary_skill} Question` : currentQ === 8 ? "Achievement Question" : "General Knowledge"}
          </div>
          <p className="text-lg font-medium text-slate-900">{questions[currentQ]}</p>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <textarea
          value={currentAnswer}
          onChange={e => { setCurrentAnswer(e.target.value); setError(""); }}
          onPaste={handlePaste}
          onContextMenu={e => e.preventDefault()}
          placeholder="Type your answer here... (copy-paste is disabled)"
          rows={6}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 resize-none"
        />

        <button
          onClick={() => handleNextQuestion(false)}
          className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700"
        >
          {currentQ + 1 === questions.length ? "Submit Interview →" : "Next Question →"}
        </button>
      </div>
    </div>
  );

  if (stage === "evaluating") return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">🤖</div>
        <h2 className="text-xl font-bold text-slate-900">AI is evaluating your answers...</h2>
        <p className="mt-2 text-slate-500">This takes about 10-15 seconds</p>
      </div>
    </div>
  );

  if (stage === "result" && result) return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full">
        <div className="rounded-3xl border border-slate-200 p-8 shadow-sm text-center">
          <div className="text-5xl mb-4">
            {result.score >= 90 ? "🏆" : result.score >= 80 ? "⭐" : result.score >= 70 ? "✅" : result.score >= 60 ? "👍" : "📚"}
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{result.score}/100</h1>
          <div className="mt-2 inline-block px-4 py-1 bg-slate-900 text-white rounded-full text-sm font-semibold">
            {result.badge}
          </div>
          <p className="mt-4 text-slate-600 text-sm">{result.feedback}</p>

          <div className="mt-6 p-4 bg-slate-50 rounded-xl text-left">
            <p className="text-xs text-slate-500 font-semibold uppercase">Attempts remaining</p>
            <p className="text-sm font-medium text-slate-900 mt-1">{attemptsLeft - 1} of 2</p>
          </div>

          <div className="mt-4 space-y-3">
            {attemptsLeft - 1 > 0 && (
              <button
                onClick={() => { setStage("intro"); setAttemptsLeft(prev => prev - 1); }}
                className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700"
              >
                Try Again ({attemptsLeft - 1} attempt left)
              </button>
            )}
            <button
              onClick={() => navigate("/")}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}