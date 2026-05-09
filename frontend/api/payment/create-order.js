import Razorpay from "razorpay";
import jwt from "jsonwebtoken";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

  const { workerId } = req.body;
  if (!workerId) return res.status(400).json({ error: "workerId required" });

  const order = await razorpay.orders.create({
    amount: 29900,
    currency: "INR",
    receipt: `unlock_${company.companyId}_${workerId}`.slice(0, 40),
    notes: { companyId: company.companyId, workerId },
  });

  return res.status(200).json({ orderId: order.id, amount: order.amount, currency: order.currency });
}