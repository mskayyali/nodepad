import esbuild from "esbuild"
import process from "process"
import builtins from "builtin-modules"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prod = process.argv[2] === "production"

fs.mkdirSync("dist", { recursive: true })

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  alias: {
    "@/lib": path.resolve(__dirname, "../lib"),
    "@/components": path.resolve(__dirname, "../components"),
    "@/app": path.resolve(__dirname, "../app"),
    "react": path.resolve(__dirname, "node_modules/react"),
    "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime"),
    "react/jsx-dev-runtime": path.resolve(__dirname, "node_modules/react/jsx-dev-runtime"),
    "react-dom/client": path.resolve(__dirname, "node_modules/react-dom/client"),
  },
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "dist/main.js",
  jsx: "automatic",
})

if (prod) {
  await context.rebuild()
  fs.copyFileSync("manifest.json", "dist/manifest.json")
  process.exit(0)
} else {
  fs.copyFileSync("manifest.json", "dist/manifest.json")
  await context.watch()
}
