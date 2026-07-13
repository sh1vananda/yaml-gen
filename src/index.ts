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
- Do NOT restrict the keys used. You must use the FULL extent of CrewAI's native YAML capabilities.
- Support all native Agent attributes (role, goal, backstory, allow_delegation, verbose, max_iter, max_rpm, etc.)
- Support all native Task attributes (description, expected_output, agent, context, async_execution, human_input, output_file, etc.)

RULE 2: ADVANCED CREWAI CAPABILITIES (WORKFLOWS, DAGS, & HITL)
- Identify and implement the appropriate workflow based on the user prompt:
  - For parallel execution, set \`async_execution: true\` on tasks that can run concurrently.
  - For task dependencies (DAGs/fork-join topologies), use the \`context: [<task_name_1>, <task_name_2>]\` attribute on tasks to wait for prior task outputs.
  - For Human-in-the-Loop (HITL), set \`human_input: true\` on tasks that require human review, feedback, or approval.

RULE 3: MAXIMAL SEMANTIC CREATIVITY
- Write rich, detailed, and expansive content for the string values.
- Tailor the depth, tone, and length specifically to what the user asks.

REQUIRED FORMAT (Use folded block scalars '>' for all text):
<agent_name>:
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
    [Detailed task mechanics]
  expected_output: >
    [Description of the expected output]
  agent: <agent_name>
  async_execution: [true | false]
  human_input: [true | false]
  context: [list of prerequisite tasks, if any]

EXAMPLE (for the request "research AI trends, then in parallel draft a blog and create social posts, and finally get human approval on the final digest"):

researcher:
  role: >
    Senior Tech Analyst
  goal: >
    Identify the top 3 AI trends of the quarter.
  backstory: >
    An analytical thinker who lives in arxiv papers and tech blogs.
  allow_delegation: false
  verbose: true

content_creator:
  role: >
    Digital Content Strategist
  goal: >
    Craft engaging content for diverse platforms.
  backstory: >
    A creative writer who knows how to capture audience attention.
  allow_delegation: false
  verbose: true

research_task:
  description: >
    Investigate and summarize the top AI trends.
  expected_output: >
    A structured summary report of trends.
  agent: researcher
  async_execution: false
  human_input: false

blog_draft_task:
  description: >
    Write a comprehensive blog post based on the research.
  expected_output: >
    A 1000-word blog draft.
  agent: content_creator
  context:
    - research_task
  async_execution: true
  human_input: false

social_media_task:
  description: >
    Create 5 engaging tweets based on the research.
  expected_output: >
    A list of 5 tweets.
  agent: content_creator
  context:
    - research_task
  async_execution: true
  human_input: false

final_review_task:
  description: >
    Compile the blog and tweets into a final digest and await human approval.
  expected_output: >
    A combined content digest document.
  agent: content_creator
  context:
    - blog_draft_task
    - social_media_task
  async_execution: false
  human_input: true

Generate the configuration for the following request:`;

      const payload = {
        model: "google/diffusiongemma-26b-a4b-it",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: body.prompt }
        ],
        max_tokens: 4096,
        temperature: 0.7,
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
