export default async function handler(req, res) {
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });
  
    const { skill, questions, answers } = req.body;
  
    const qa = questions.map((q, i) =>
      `Q${i+1}: ${q}\nA${i+1}: ${answers[i] || "(no answer)"}`
    ).join("\n\n");
  
    const prompt = `You are an expert evaluator for ${skill} interviews.
  
  Evaluate these 10 interview answers and give a score from 0-100:
  
  ${qa}
  
  Scoring criteria:
  - Technical accuracy (40%)
  - Depth of knowledge (30%)
  - Communication clarity (20%)
  - Problem-solving approach (10%)
  
  Return ONLY a JSON object, no other text:
  {"score": <number 0-100>, "feedback": "<2-3 sentence overall feedback>", "badge": "<one of: Unverified, Verified, Skilled, Expert, Master>"}
  
  Badge criteria: 0-59=Unverified, 60-69=Verified, 70-79=Skilled, 80-89=Expert, 90-100=Master`;
  
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );
  
      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text.trim();
      const clean = text.replace(/```json|```/g, "").trim();
      const result = JSON.parse(clean);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }