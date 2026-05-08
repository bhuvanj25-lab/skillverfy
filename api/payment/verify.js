import crypto from "crypto";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../_lib/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  let company;
  try {
    company = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, workerId } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature)
    return res.status(400).json({ error: "Payment verification failed" });

  const supabase = supabaseAdmin();

  const { error } = await supabase.from("contact_unlocks").upsert({
    company_id: company.companyId,
    worker_id: workerId,
    amount_paid: 299,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true, message: "Contact unlocked!" });
}