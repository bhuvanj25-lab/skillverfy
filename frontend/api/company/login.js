import { supabaseAdmin } from "../_lib/supabaseAdmin.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body;

  const supabase = supabaseAdmin();

  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !company)
    return res.status(401).json({ error: "Invalid email or password" });

  const valid = await bcrypt.compare(password, company.password_hash);
  if (!valid)
    return res.status(401).json({ error: "Invalid email or password" });

  const token = jwt.sign(
    { companyId: company.id, email: company.email, name: company.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.status(200).json({ token, company: { id: company.id, name: company.name, email: company.email } });
}