import { isIP } from "node:net"
import { NextRequest, NextResponse } from "next/server"

type UrlMeta = {
  title: string
  description: string
  excerpt: string
  statusCode: number
}

function extractMeta(html: string): Omit<UrlMeta, "statusCode"> {
  const tag = (pattern: RegExp) => {
    const m = html.match(pattern)
    return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim() : ""
  }

  const title =
    tag(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
    tag(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i) ||
    tag(/<title[^>]*>([^<]{1,200})<\/title>/i)

  const description =
    tag(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i) ||
    tag(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i) ||
    tag(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
    tag(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i)

  const excerpt = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600)

  return { title: title.slice(0, 200), description: description.slice(0, 400), excerpt }
}

// Manually follow redirects so every hop is SSRF-checked. Without this, a
// public URL could 302 to http://169.254.169.254/ (cloud metadata) or similar.
async function fetchUrlMeta(url: string): Promise<UrlMeta | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    let res: Response
    try {
      let current = url
      let hops = 0
      const MAX_HOPS = 5
      while (true) {
        if (isBlockedHost(current)) return null
        res = await fetch(current, {
          signal: controller.signal,
          headers: {
            "User-Agent": "nodepad/1.0 (+https://nodepad.space)",
            "Accept": "text/html,application/xhtml+xml",
          },
          redirect: "manual",
        })
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location")
          if (!loc) break
          if (++hops > MAX_HOPS) return null
          current = new URL(loc, current).toString()
          continue
        }
        break
      }
    } finally {
      clearTimeout(timer)
    }

    const statusCode = res.status
    if (!res.ok) return { title: "", description: "", excerpt: "", statusCode }

    const ct = res.headers.get("content-type") || ""
    if (!ct.includes("text/html")) {
      const kind = ct.split(";")[0].trim()
      return { title: "", description: `Non-HTML resource: ${kind}`, excerpt: "", statusCode }
    }

    const html = await res.text()
    return { ...extractMeta(html), statusCode }
  } catch {
    return null
  }
}

// ── SSRF protection ───────────────────────────────────────────────────────────
// Blocks requests to private/reserved IP ranges and special hostnames so this
// endpoint cannot be used to probe internal networks or cloud metadata services.

// Parse an IPv4 literal in any form Node/glibc accepts: dotted-decimal,
// dotted-octal (0177.0.0.1), dotted-hex (0x7f.0.0.1), and single 32-bit
// integer (2130706433 = 127.0.0.1). Returns [a,b,c,d] or null.
function parseIPv4(h: string): [number, number, number, number] | null {
  const parts = h.split(".")
  if (parts.length < 1 || parts.length > 4) return null

  const parseNum = (s: string): number | null => {
    if (!s) return null
    let n: number
    if (/^0x[0-9a-f]+$/i.test(s)) n = parseInt(s, 16)
    else if (/^0[0-7]+$/.test(s)) n = parseInt(s, 8)
    else if (/^[0-9]+$/.test(s)) n = parseInt(s, 10)
    else return null
    return Number.isFinite(n) ? n : null
  }

  const nums = parts.map(parseNum)
  if (nums.some(n => n === null)) return null
  const ns = nums as number[]

  // Each form packs remaining bytes into the final component.
  let a: number, b: number, c: number, d: number
  if (ns.length === 4) {
    [a, b, c, d] = ns
    if ([a, b, c, d].some(x => x < 0 || x > 255)) return null
  } else if (ns.length === 3) {
    [a, b] = ns
    const last = ns[2]
    if (a > 255 || b > 255 || last < 0 || last > 0xffff) return null
    c = (last >> 8) & 0xff
    d = last & 0xff
  } else if (ns.length === 2) {
    a = ns[0]
    const last = ns[1]
    if (a > 255 || last < 0 || last > 0xffffff) return null
    b = (last >> 16) & 0xff
    c = (last >> 8) & 0xff
    d = last & 0xff
  } else {
    const last = ns[0]
    if (last < 0 || last > 0xffffffff) return null
    a = (last >> 24) & 0xff
    b = (last >> 16) & 0xff
    c = (last >> 8) & 0xff
    d = last & 0xff
  }
  return [a, b, c, d]
}

function isBlockedIPv4(a: number, b: number, c: number, _d: number): boolean {
  if (a === 0)                              return true // 0.0.0.0/8
  if (a === 10)                             return true // 10.0.0.0/8
  if (a === 127)                            return true // 127.0.0.0/8 loopback
  if (a === 169 && b === 254)               return true // 169.254.0.0/16 link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31)      return true // 172.16.0.0/12
  if (a === 192 && b === 168)               return true // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127)     return true // 100.64.0.0/10 shared space
  if (a === 198 && (b === 18 || b === 19))  return true // 198.18.0.0/15 benchmarking
  if (a === 203 && b === 0 && c === 113)    return true // 203.0.113.0/24 documentation
  if (a >= 224)                             return true // multicast + reserved (224–255)
  return false
}

// Expand an IPv4-mapped/compatible IPv6 literal (::ffff:127.0.0.1 or ::7f00:1)
// into its IPv4 form so we reuse isBlockedIPv4. Returns null if not mapped.
function ipv6ToMappedIPv4(h: string): [number, number, number, number] | null {
  // Dotted-quad suffix form: ::ffff:127.0.0.1
  const dotted = h.match(/^(?:0*:)*(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i)
  if (dotted) return parseIPv4(dotted[1])

  // Hex-word form: ::ffff:7f00:1 → 127.0.0.1
  // Expand `::` and look at the last two 16-bit groups as an IPv4 address.
  if (!h.includes(":")) return null
  const hasDoubleColon = h.includes("::")
  const [left, right] = hasDoubleColon ? h.split("::") : [h, ""]
  const leftParts = left ? left.split(":") : []
  const rightParts = right ? right.split(":") : []
  const missing = 8 - leftParts.length - rightParts.length
  if (missing < 0) return null
  const groups = [
    ...leftParts,
    ...Array(hasDoubleColon ? missing : 0).fill("0"),
    ...rightParts,
  ]
  if (groups.length !== 8) return null
  if (!groups.every(g => /^[0-9a-f]{1,4}$/i.test(g))) return null
  const nums = groups.map(g => parseInt(g, 16))
  // Must be ::ffff:x:x (mapped) or ::x:x (compat, high-64 and bits 64-95 zero).
  const highZero = nums.slice(0, 5).every(n => n === 0)
  const isMapped = highZero && nums[5] === 0xffff
  const isCompat = highZero && nums[5] === 0
  if (!isMapped && !isCompat) return null
  const a = (nums[6] >> 8) & 0xff
  const b = nums[6] & 0xff
  const c = (nums[7] >> 8) & 0xff
  const d = nums[7] & 0xff
  return [a, b, c, d]
}

function isBlockedHost(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return true // unparseable → block
  }

  // Only http/https — no file://, ftp://, etc.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true

  // Normalize: lowercase, strip IPv6 brackets, strip trailing dot (so
  // "localhost." can't bypass the named-host check below).
  const h = parsed.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")

  // Named loopback / metadata hostnames
  if (h === "localhost") return true
  if (h === "metadata.google.internal") return true

  // IPv6 literals. Only apply IPv6 prefix checks to real IPv6 addresses so
  // ordinary hostnames beginning with "fc"/"fd" (e.g. fda.gov) are not blocked.
  if (isIP(h) === 6) {
    if (h === "::" || h === "0:0:0:0:0:0:0:0") return true            // unspecified
    if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true           // loopback
    if (h.startsWith("fe80:")) return true                            // link-local
    if (h.startsWith("fc") || h.startsWith("fd")) return true         // ULA fc00::/7
    // IPv4-mapped / -compatible: reuse IPv4 rules so ::ffff:127.0.0.1 is blocked.
    const mapped = ipv6ToMappedIPv4(h)
    if (mapped && isBlockedIPv4(...mapped)) return true
    return false
  }

  // IPv4 literal in any Node-accepted form (dotted-decimal, octal, hex,
  // or packed integer like 2130706433 = 127.0.0.1).
  if (isIP(h) === 4 || /^[0-9a-fx.]+$/i.test(h)) {
    const v4 = parseIPv4(h)
    if (v4 && isBlockedIPv4(...v4)) return true
  }

  return false
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    const urlStr = String(url ?? "")

    if (!urlStr || !/^https?:\/\//i.test(urlStr)) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }
    if (isBlockedHost(urlStr)) {
      return NextResponse.json({ error: "Blocked URL" }, { status: 400 })
    }

    const meta = await fetchUrlMeta(urlStr)
    return NextResponse.json(meta)
  } catch {
    return NextResponse.json(null)
  }
}
