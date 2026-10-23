const ALLOWED_HEADERS = "authorization, content-type";
const MAX_REQUEST_BYTES = 24_000;
const MAX_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 4_000;

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": ALLOWED_HEADERS,
    "access-control-max-age": "600",
    "vary": "Origin",
  };
}

function json(data, status, origin) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
  if (origin) Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify(data), { status, headers });
}

function equalSecret(first, second) {
  const a = new TextEncoder().encode(first);
  const b = new TextEncoder().encode(second);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

const TUTOR_INSTRUCTIONS = `You are Artha, a friendly personal Economics tutor for a Class 11 Commerce student. Explain concepts clearly and step by step. When useful, give a simple definition, an everyday example, then one practice question. Show calculation steps. Correct mistakes kindly. Ask which board or state syllabus applies when needed; never invent textbook page numbers or official exam rules. If uncertain, say so. Do not provide personal investment advice.`;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (!env.SITE_ORIGIN || origin !== env.SITE_ORIGIN) {
      return json({ error: "This origin is not allowed." }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (new URL(request.url).pathname !== "/api/chat" || request.method !== "POST") {
      return json({ error: "Not found." }, 404, origin);
    }
    if (!env.OPENAI_API_KEY || !env.OWNER_ACCESS_TOKEN) {
      return json({ error: "The owner AI service is not configured yet." }, 503, origin);
    }

    const bearer = request.headers.get("Authorization") || "";
    const suppliedToken = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
    if (!equalSecret(suppliedToken, env.OWNER_ACCESS_TOKEN)) {
      return json({ error: "Owner access token did not match." }, 401, origin);
    }

    const length = Number(request.headers.get("Content-Length") || "0");
    if (length > MAX_REQUEST_BYTES) return json({ error: "That conversation is too long." }, 413, origin);

    let body;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > MAX_REQUEST_BYTES) {
        return json({ error: "That conversation is too long." }, 413, origin);
      }
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Send a valid chat message." }, 400, origin);
    }

    const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
    if (!messages.length || messages.some((message) =>
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.trim() ||
      message.content.length > MAX_MESSAGE_CHARS
    )) {
      return json({ error: "Chat history is invalid or too long." }, 400, origin);
    }

    try {
      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.OPENAI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || "gpt-6-astra",
          instructions: TUTOR_INSTRUCTIONS,
          input: messages.map(({ role, content }) => ({ role, content })),
          max_output_tokens: 700,
          store: false,
        }),
      });

      const result = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        const status = upstream.status === 401 || upstream.status === 403 ? 502 : upstream.status;
        return json({ error: status === 502 ? "The AI service could not authorize this request. Check its server configuration." : "The AI service could not answer just now." }, status, origin);
      }

      const answer = result.output_text || (result.output || [])
        .flatMap((item) => item.content || [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text)
        .join("\n");

      if (!answer) return json({ error: "The AI returned an empty reply. Try again." }, 502, origin);
      return json({ answer }, 200, origin);
    } catch {
      return json({ error: "Could not reach the AI service. Try again in a moment." }, 502, origin);
    }
  },
};
