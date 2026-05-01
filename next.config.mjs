/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Build errors are intentionally ignored — see CLAUDE.md
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Apply security headers to every route
        source: "/(.*)",
        headers: [
          {
            // Prevent framing (clickjacking)
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // Stop MIME-type sniffing
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // Limit referrer info sent to third-party origins
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // Permissions policy — disable features the app doesn't use
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            // Content Security Policy
            // - default-src self: everything defaults to same-origin
            // - script-src: Next.js needs 'unsafe-inline' + 'unsafe-eval' in dev;
            //   nonces are the proper fix but require custom server — this is the
            //   pragmatic baseline for a static/Vercel deployment.
            // - connect-src: https: allows any user-configured custom endpoint
            // - img-src: data URIs for inline images, blob for canvas exports
            // - style-src unsafe-inline: Tailwind injects inline styles at runtime
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cloud.umami.is",
              "style-src 'self' 'unsafe-inline'",
              // Allow all HTTPS so user-configured custom base URLs (arbitrary
              // OpenAI-compatible endpoints) are not blocked by CSP. Enumerating
              // specific provider domains is incompatible with a custom-URL feature.
              // http://localhost:* covers local providers (Ollama, LM Studio, vLLM).
              "connect-src 'self' https: http://localhost:*",
              "img-src 'self' data: blob: https://i.ytimg.com",
              "font-src 'self' data:",
              "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
