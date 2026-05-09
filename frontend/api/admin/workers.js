import { supabaseAdmin } from "../_lib/supabaseAdmin.js";

function json(res, status, body) {
  res.status(status).setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function requireAdminKey(req) {
  const header = req.headers["x-admin-key"];
  const expected = process.env.ADMIN_KEY;
  if (!expected) throw new Error("Missing env var: ADMIN_KEY");
  if (!header || header !== expected) return false;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("allow", "GET");
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const ok = requireAdminKey(req);
    if (!ok) return json(res, 401, { error: "Unauthorized" });

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("workers")
      .select(
        "id, full_name, email, phone, primary_skill, years_experience, portfolio_link, score, verified, failed_until, suspicious_flags, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { workers: data || [] });
  } catch (e) {
    return json(res, 500, { error: e?.message || "Server error" });
  }
}

