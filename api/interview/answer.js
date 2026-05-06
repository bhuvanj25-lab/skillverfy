import { callClaude, parseClaudeJson } from "../_lib/claude.js";
import { supabaseAdmin } from "../_lib/supabaseAdmin.js";

function json(res, status, body) {
  res.status(status).setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function requireBody(req) {
  if (!req.body) throw new Error("Missing JSON body.");
  return req.body;
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = requireBody(req);
    const sessionId = body.sessionId;
    const answer = String(body.answer ?? "").trim();

    if (!sessionId) return json(res, 400, { error: "sessionId is required" });
    if (!answer) return json(res, 400, { error: "answer is required" });

    const sb = supabaseAdmin();

    const { data: session, error: sErr } = await sb
      .from("interview_sessions")
      .select(
        "id, worker_id, skill, question_index, messages, per_question_scores, total_score, status"
      )
      .eq("id", sessionId)
      .single();

    if (sErr) return json(res, 404, { error: "Session not found" });
    if (session.status !== "in_progress") {
      return json(res, 400, { error: "Session not in progress" });
    }

    const qIndex = Number(session.question_index || 0);
    if (qIndex < 1 || qIndex > 5) {
      return json(res, 400, { error: "Invalid session question index" });
    }

    const prevMessages = Array.isArray(session.messages) ? session.messages : [];
    const updatedMessages = [
      ...prevMessages,
      { role: "user", content: answer }
    ];

    const wantFinal = qIndex >= 5;

    const userInstruction = wantFinal
      ? `You have asked 5 questions already. Evaluate the LAST answer strictly (0-20). Then provide ONE coding task. Then provide the FINAL total score out of 100 and pass/fail.\nReturn ONLY JSON:\n{"type":"final","lastScore":number,"totalScore":number,"pass":boolean,"codingTask":"...","feedback":"..."}`
      : `Evaluate the LAST answer strictly (0-20). Then ask the NEXT technical question (question ${
          qIndex + 1
        } of 5).\nReturn ONLY JSON:\n{"type":"question","questionIndex":${
          qIndex + 1
        },"lastScore":number,"text":"...","feedback":"..."}\nNever include hints.`;

    const { rawText } = await callClaude({
      messages: [
        ...updatedMessages,
        { role: "user", content: userInstruction }
      ],
      maxTokens: wantFinal ? 700 : 400
    });

    const parsed = parseClaudeJson(rawText);
    const lastScore = clampInt(parsed?.lastScore, 0, 20);

    const prevScores = Array.isArray(session.per_question_scores)
      ? session.per_question_scores
      : [];
    const newScores = [...prevScores, lastScore];
    const totalScore = wantFinal
      ? clampInt(parsed?.totalScore, 0, 100)
      : clampInt((session.total_score || 0) + lastScore, 0, 100);

    let nextPayload;

    if (!wantFinal) {
      if (parsed?.type !== "question" || !parsed?.text) {
        return json(res, 502, { error: "Bad Claude response", raw: rawText });
      }

      const nextQuestion = parsed.text;
      const nextMessages = [
        ...updatedMessages,
        { role: "assistant", content: nextQuestion }
      ];

      const { error: upErr } = await sb
        .from("interview_sessions")
        .update({
          messages: nextMessages,
          question_index: qIndex + 1,
          per_question_scores: newScores,
          total_score: totalScore,
          updated_at: new Date().toISOString()
        })
        .eq("id", sessionId);

      if (upErr) return json(res, 500, { error: upErr.message });

      nextPayload = {
        type: "question",
        questionIndex: qIndex + 1,
        lastScore,
        totalScore,
        feedback: parsed?.feedback || "",
        text: nextQuestion
      };
    } else {
      if (parsed?.type !== "final" || !parsed?.codingTask) {
        return json(res, 502, { error: "Bad Claude response", raw: rawText });
      }

      const pass = !!parsed.pass || totalScore >= 70;

      // Persist session final
      const { error: finErr } = await sb
        .from("interview_sessions")
        .update({
          messages: updatedMessages,
          question_index: 5,
          per_question_scores: newScores,
          total_score: totalScore,
          status: "finished",
          coding_task: String(parsed.codingTask),
          updated_at: new Date().toISOString()
        })
        .eq("id", sessionId);

      if (finErr) return json(res, 500, { error: finErr.message });

      // Save to workers table
      const updateWorker = pass
        ? {
            score: totalScore,
            verified: true,
            failed_until: null,
            updated_at: new Date().toISOString()
          }
        : {
            score: totalScore,
            verified: false,
            failed_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
          };

      const { error: wUpErr } = await sb
        .from("workers")
        .update(updateWorker)
        .eq("id", session.worker_id);

      if (wUpErr) return json(res, 500, { error: wUpErr.message });

      nextPayload = {
        type: "final",
        lastScore,
        totalScore,
        pass,
        feedback: parsed?.feedback || "",
        codingTask: String(parsed.codingTask),
        retryAfter: pass ? null : updateWorker.failed_until
      };
    }

    return json(res, 200, nextPayload);
  } catch (e) {
    return json(res, 500, { error: e?.message || "Server error" });
  }
}

