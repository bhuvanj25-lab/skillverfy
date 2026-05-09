export default async function handler(req, res) {
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });
  
    const { skill } = req.body;
  
    const prompt = `You are an expert technical interviewer for ${skill}.
  
  Generate exactly 10 interview questions for a ${skill} professional:
  - Questions 1-8: Practical, real-world ${skill} technical questions. Mix of conceptual, problem-solving, and scenario-based. Make them challenging but fair.
  - Question 9: Ask about their biggest achievement or project in ${skill}
  - Question 10: A general logical thinking or problem-solving question (not skill-specific)
  
  Return ONLY a JSON array of 10 strings, no other text:
  ["question1", "question2", ..., "question10"]`;
  
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
      const questions = JSON.parse(clean);
      return res.status(200).json({ questions });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }