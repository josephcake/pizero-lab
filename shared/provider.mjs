import { SYSTEM_PROMPT } from "./context.mjs";

export async function askProvider({ provider, model, apiKey, context, question, fetchImpl = fetch }) {
  const payload = `${question}\n\n${JSON.stringify(context)}`;
  if (provider === "anthropic") {
    const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: payload }],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "anthropic");
    return (data.content || []).map((block) => block.text || "").join("\n");
  }
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: payload },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "openai");
  return data.choices?.[0]?.message?.content || "";
}
