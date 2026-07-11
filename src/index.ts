export interface Env {
  NVIDIA_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body: { prompt: string } = await request.json();

      const systemPrompt = `You are an expert CrewAI configuration architect.

RULE 1: STRICT STRUCTURAL RIGIDITY
- Output ONLY raw, valid YAML.
- Do NOT wrap in markdown blocks (\`\`\`). No preamble, no commentary.
- Valid Agent keys: role, goal, backstory, allow_delegation, verbose.
- Valid Task keys: description, expected_output, agent.

RULE 2: MAXIMAL SEMANTIC CREATIVITY
- Write rich, detailed, and expansive content for the string values.
- Tailor the depth, tone, and length specifically to what the user asks.

REQUIRED FORMAT (Use folded block scalars '>' for all text):
<target_name>:
  role: >
    [Insert highly specific role]
  goal: >
    [Insert comprehensive goal]
  backstory: >
    [Insert rich, creative, deeply detailed backstory]
  allow_delegation: false
  verbose: true

<task_name>:
  description: >
    [Insert detailed step-by-step task mechanics]
  expected_output: >
    [Insert exact, rigorous output requirements]
  agent: <target_name>

Generate the configuration for the following request:`;

      // Your exact payload tailored for the native fetch API
      const payload = {
        model: "google/diffusiongemma-26b-a4b-it",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: body.prompt }
        ],
        max_tokens: 4096,
        temperature: 0.7, // See note below regarding this value
        top_p: 0.95,
        stream: false,
        chat_template_kwargs: { enable_thinking: true }
      };

      const nimResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.NVIDIA_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      if (!nimResponse.ok) {
        const errorText = await nimResponse.text();
        return new Response(`NVIDIA API Error: ${errorText}`, { status: nimResponse.status });
      }

      const data: any = await nimResponse.json();
      const yamlContent = data.choices[0].message.content;

      return new Response(yamlContent, {
        headers: { "Content-Type": "application/x-yaml" }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: "Malformed request payload or network error" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
