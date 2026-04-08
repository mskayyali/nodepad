import { spawn } from "node:child_process"

const command = process.platform === "win32" ? "npm.cmd" : "npm"
const child = spawn(command, ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, TAURI_ENV: "1" },
})

child.on("error", (err) => {
  console.error("Failed to start Tauri build command:", err)
  process.exit(1)
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
