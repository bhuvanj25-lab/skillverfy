const SYSTEM_PROMPT = `You are a strict skill interviewer.
Ask 5 technical questions one by one
based on the worker's skill.
After 5 questions give one coding task.
Score each answer strictly out of 20.
Total score out of 100.
Pass mark is 70.
Never give hints.
If answer seems AI generated ask them
to explain in their own words.
Be professional and encouraging.`;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function callClaude({ messages, maxTokens = 500 }) {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Claude API error (${resp.status}): ${text}`);
  }

  const json = await resp.json();
  const content = json?.content?.[0]?.text ?? "";
  return { rawText: content };
}

export function parseClaudeJson(rawText) {
  // Claude will be prompted to return JSON only. This parser also tries
  // to recover if it wraps JSON in text/code fences.
  const trimmed = String(rawText ?? "").trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  // Try direct parse
  try {
    return JSON.parse(candidate);
  } catch {
    // Try extracting first {...} block
    const objMatch = candidate.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    throw new Error("Could not parse Claude JSON response.");
  }
}

