import { spawn } from "child_process"

const LOCAL_MODELS_ENABLED = process.env.WITH_LOCAL_MODELS === "true"

interface Message {
  role: "system" | "user" | "assistant"
  content: string
}

interface RequestBody {
  model?: string
  messages: Message[]
  response_format?: { type: string; json_schema?: unknown }
  temperature?: number
}

export async function POST(req: Request): Promise<Response> {
  if (!LOCAL_MODELS_ENABLED) {
    return Response.json({ error: "Local models are not enabled" }, { status: 403 })
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { model, messages } = body

  // Combine system + user messages into a single prompt for the CLI
  const systemMsg = messages.find(m => m.role === "system")?.content ?? ""
  const userMsg = messages
    .filter(m => m.role === "user")
    .map(m => m.content)
    .join("\n\n")

  const fullPrompt = systemMsg ? `${systemMsg}\n\n${userMsg}` : userMsg

  const args = ["--print", "--output-format", "json", "--no-session-persistence"]
  if (model) args.push("--model", model)

  try {
    const content = await runClaude(args, fullPrompt)
    return Response.json({
      choices: [{ message: { role: "assistant", content } }],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}

function runClaude(args: string[], stdin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { env: process.env })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString() })

    child.on("error", (err) => reject(new Error(`Failed to spawn claude CLI: ${err.message}`)))

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`claude CLI exited with code ${code}: ${stderr.trim()}`))
        return
      }

      // Claude CLI --output-format json returns { type, result, ... }
      try {
        const parsed = JSON.parse(stdout.trim())
        if (parsed.is_error) {
          reject(new Error(`claude CLI returned an error: ${parsed.result ?? stderr}`))
          return
        }
        resolve(String(parsed.result ?? ""))
      } catch {
        // If the output isn't JSON, return it as plain text
        resolve(stdout.trim())
      }
    })

    child.stdin.write(stdin)
    child.stdin.end()
  })
}
