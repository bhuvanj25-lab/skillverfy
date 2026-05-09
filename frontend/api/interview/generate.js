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
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
  
      const data = await response.json();
      const text = data.content[0].text.trim();
      const questions = JSON.parse(text);
      return res.status(200).json({ questions });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }