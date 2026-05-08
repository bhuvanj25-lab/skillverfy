import { supabaseAdmin } from "../_lib/supabaseAdmin.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { name, email, password, industry, size, website } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email and password required" });

  const supabase = supabaseAdmin();

  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .eq("email", email)
    .single();

  if (existing)
    return res.status(409).json({ error: "Company already registered" });

  const password_hash = await bcrypt.hash(password, 10);

  const { data: company, error } = await supabase
    .from("companies")
    .insert({ name, email, password_hash, industry, size, website })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const token = jwt.sign(
    { companyId: company.id, email: company.email, name: company.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.status(201).json({ token, company: { id: company.id, name: company.name, email: company.email } });
}