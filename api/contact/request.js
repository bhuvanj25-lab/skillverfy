import { supabaseAdmin } from "../_lib/supabaseAdmin.js";

function json(res, status, body) {
  res.status(status).setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function requireBody(req) {
  if (!req.body) throw new Error("Missing JSON body.");
  return req.body;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? "").trim());
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = requireBody(req);
    const workerId = body.workerId;
    const companyName = String(body.companyName || "").trim();
    const companyEmail = String(body.companyEmail || "").trim();
    const message = String(body.message || "").trim();

    if (!workerId) return json(res, 400, { error: "workerId is required" });
    if (!companyName) return json(res, 400, { error: "companyName is required" });
    if (!isValidEmail(companyEmail))
      return json(res, 400, { error: "companyEmail is invalid" });
    if (message.length < 10)
      return json(res, 400, { error: "message must be at least 10 characters" });

    const sb = supabaseAdmin();

    // Only allow contacting verified workers
    const { data: worker, error: wErr } = await sb
      .from("workers")
      .select("id, verified, score")
      .eq("id", workerId)
      .single();

    if (wErr || !worker) return json(res, 404, { error: "Worker not found" });
    if (!worker.verified || Number(worker.score ?? 0) < 70) {
      return json(res, 400, { error: "Worker is not verified" });
    }

    const { error: insErr } = await sb.from("contact_requests").insert({
      worker_id: workerId,
      company_name: companyName,
      company_email: companyEmail,
      message
    });

    if (insErr) return json(res, 500, { error: insErr.message });
    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { error: e?.message || "Server error" });
  }
}

