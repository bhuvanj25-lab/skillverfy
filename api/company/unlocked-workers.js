import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  let company;
  try {
    company = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { data: unlocks, error } = await supabase
    .from("contact_unlocks")
    .select("worker_id, unlocked_at")
    .eq("company_id", company.companyId);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ unlockedWorkerIds: unlocks.map((u) => u.worker_id) });
}