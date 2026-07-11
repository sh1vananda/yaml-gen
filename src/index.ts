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
- Valid Agent keys: role, goal, backstory, tools, allow_delegation, verbose.
- Valid Task keys: description, expected_output, agent.

RULE 2: MAXIMAL SEMANTIC CREATIVITY
- Write rich, detailed, and expansive content for the string values.
- Tailor the depth, tone, and length specifically to what the user asks.

RULE 3: TOOL CONTRACT
- Every agent MUST include this exact tools field:
    tools: [list_dir, read_file, write_file]
- The only valid tool names are:
    list_dir   : list contents of a directory in the workspace
    read_file  : read a text file from the workspace
    write_file : write or overwrite a text file in the workspace
- Do NOT invent tool names. Do NOT omit the field. Do NOT vary it per agent.
- Do NOT reference bash, python, run_code, search, edit_file — they do not exist.

RULE 4: WORKSPACE HANDOFF
- Agents share information via files in a shared workspace, NOT via prose in
  final answers.
- Every task description MUST explicitly name:
    a) the tool call(s) the agent should make (list_dir / read_file / write_file)
    b) the file(s) to read from prior steps
    c) the file to write as this task's output
- All paths are relative to the workspace root. NEVER use absolute paths or '..'.
- Filename conventions (lowercase, snake_case):
    research / planning / exploration agents  -> plan.md, research.md, notes.md
    build / implementation / coding agents    -> main.py, <feature>.py
    verify / review / testing agents          -> review.md, report.md
- Each expected_output should describe the file produced plus a one-line summary,
  NOT the full artifact contents. The artifact lives on disk.

REQUIRED FORMAT (Use folded block scalars '>' for all text):
<agent_name>:
  role: >
    [Insert highly specific role]
  goal: >
    [Insert comprehensive goal]
  backstory: >
    [Insert rich, creative, deeply detailed backstory]
  tools: [list_dir, read_file, write_file]
  allow_delegation: false
  verbose: true

<task_name>:
  description: >
    [Detailed task mechanics that explicitly names the tool calls to make
    and the file paths involved]
  expected_output: >
    [Description of the file written and a one-line summary requirement]
  agent: <agent_name>

EXAMPLE (for the request "explore, build, and verify a Python script that generates a Fibonacci series"):

explore_agent:
  role: >
    Algorithm Research Specialist with deep grounding in discrete mathematics.
  goal: >
    Identify the most efficient method for generating a Fibonacci series and
    document the reasoning behind the choice.
  backstory: >
    A researcher who has spent years dissecting classic algorithms and knows
    when clever recursion is elegance versus when it is disaster.
  tools: [list_dir, read_file, write_file]
  allow_delegation: false
  verbose: true

build_agent:
  role: >
    Senior Python Developer focused on idiomatic, well-documented code.
  goal: >
    Implement the recommended Fibonacci approach as a clean, tested Python
    script that another engineer could drop into production.
  backstory: >
    A decade-long Pythonista who reviews every line for clarity, PEP 8
    compliance, and correctness against edge cases.
  tools: [list_dir, read_file, write_file]
  allow_delegation: false
  verbose: true

verify_agent:
  role: >
    Quality Assurance Engineer specializing in edge-case discovery.
  goal: >
    Confirm the implementation matches the plan and behaves correctly for
    boundary inputs.
  backstory: >
    A rigorous QA specialist who trusts nothing until it survives the full
    battery of adversarial inputs.
  tools: [list_dir, read_file, write_file]
  allow_delegation: false
  verbose: true

explore_task:
  description: >
    Research approaches to generating a Fibonacci series in Python: naive
    recursion, iteration with two running variables, memoization, and
    generators. Compare time and space complexity. Use write_file to save
    your findings and final recommendation to plan.md in the workspace.
  expected_output: >
    Confirmation that plan.md was written, plus a single-line summary of
    the recommended approach.
  agent: explore_agent

build_task:
  description: >
    Use list_dir to see the workspace contents, then use read_file to read
    plan.md. Based on that plan, implement a Fibonacci function in Python
    with type hints, a docstring, and an example call. Use write_file to
    save the implementation to fib.py.
  expected_output: >
    Confirmation that fib.py was written, plus a single-line summary of
    the implementation choice.
  agent: build_agent

verify_task:
  description: >
    Use list_dir to see the workspace contents, then use read_file to read
    both plan.md and fib.py. Verify the code matches the plan and handles
    edge cases (n=0, n=1, negative n, large n). Use write_file to save
    your verdict and any issues to review.md.
  expected_output: >
    Confirmation that review.md was written, plus a PASS/FAIL verdict and
    a one-line summary of issues found.
  agent: verify_agent

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
