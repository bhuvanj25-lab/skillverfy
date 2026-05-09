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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = requireBody(req);
    const workerId = body.workerId;
    const skill = String(body.skill || "").trim();

    if (!workerId) return json(res, 400, { error: "workerId is required" });
    if (!skill) return json(res, 400, { error: "skill is required" });

    const sb = supabaseAdmin();

    const { data: worker, error: wErr } = await sb
      .from("workers")
      .select("id, primary_skill, failed_until")
      .eq("id", workerId)
      .single();

    if (wErr) return json(res, 404, { error: "Worker not found" });

    if (worker.failed_until) {
      const until = new Date(worker.failed_until).getTime();
      if (!Number.isNaN(until) && until > Date.now()) {
        return json(res, 403, {
          error: "Retry locked",
          retryAfter: worker.failed_until
        });
      }
    }

    // Ask Claude for the first question only (JSON response).
    const { rawText } = await callClaude({
      messages: [
        {
          role: "user",
          content:
            `Skill: ${skill}\n\n` +
            `Start the interview now.\n\n` +
            `Return ONLY valid JSON with this shape:\n` +
            `{"type":"question","questionIndex":1,"text":"..."}\n` +
            `Ask the first technical question.`
        }
      ],
      maxTokens: 300
    });

    const parsed = parseClaudeJson(rawText);
    if (parsed?.type !== "question" || !parsed?.text) {
      return json(res, 502, {
        error: "Bad Claude response",
        raw: rawText
      });
    }

    // Create session in Supabase
    const initialMessages = [
      { role: "user", content: `Skill: ${skill}. Start interview.` },
      { role: "assistant", content: parsed.text }
    ];

    const { data: session, error: sErr } = await sb
      .from("interview_sessions")
      .insert({
        worker_id: workerId,
        skill,
        question_index: 1,
        messages: initialMessages,
        status: "in_progress"
      })
      .select("id")
      .single();

    if (sErr) return json(res, 500, { error: sErr.message });

    return json(res, 200, {
      sessionId: session.id,
      questionIndex: 1,
      text: parsed.text
    });
  } catch (e) {
    return json(res, 500, { error: e?.message || "Server error" });
  }
}

