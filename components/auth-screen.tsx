"use client"

import { useState } from "react"
import { loginUser, registerUser, type SessionUser } from "@/lib/auth"

interface AuthScreenProps {
  onAuthenticated: (user: SessionUser) => void
  onSkip: () => void
}

export function AuthScreen({ onAuthenticated, onSkip }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      if (mode === "register") {
        if (password !== confirmPassword) {
          setError("Passwords do not match.")
          return
        }
        const result = await registerUser(username, password)
        if (result.error || !result.user) {
          setError(result.error || "Registration failed.")
          return
        }
        onAuthenticated(result.user)
        return
      }

      const result = await loginUser(username, password)
      if (result.error || !result.user) {
        setError(result.error || "Login failed.")
        return
      }
      onAuthenticated(result.user)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
        <h1 className="font-mono text-lg font-bold tracking-tight">nodepad</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {mode === "login" ? "Sign in to continue." : "Create an account to start."}
        </p>

        <div className="mt-4 flex rounded-sm bg-muted p-1">
          <button
            onClick={() => { setMode("login"); setError("") }}
            aria-pressed={mode === "login"}
            className={`flex-1 rounded-sm px-2 py-1 text-xs font-medium ${mode === "login" ? "bg-background text-foreground" : "text-muted-foreground"}`}
          >
            Login
          </button>
          <button
            onClick={() => { setMode("register"); setError("") }}
            aria-pressed={mode === "register"}
            className={`flex-1 rounded-sm px-2 py-1 text-xs font-medium ${mode === "register" ? "bg-background text-foreground" : "text-muted-foreground"}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="space-y-1">
            <label htmlFor="auth-username" className="block text-[11px] text-muted-foreground">
              Username
            </label>
            <input
              id="auth-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="auth-password" className="block text-[11px] text-muted-foreground">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          {mode === "register" && (
            <div className="space-y-1">
              <label htmlFor="auth-confirm-password" className="block text-[11px] text-muted-foreground">
                Confirm password
              </label>
              <input
                id="auth-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {isSubmitting ? "Please wait..." : mode === "login" ? "Login" : "Register"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full rounded-sm border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            Skip login for now
          </button>
        </form>
      </div>
    </div>
  )
}
