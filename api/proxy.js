// Vercel Edge — CORS + SSE streaming proxy
// Supports both Anthropic and OpenAI APIs
export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key, x-base-url, x-provider, anthropic-version, authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const provider = req.headers.get('x-provider') || 'anthropic'
  const baseUrl = req.headers.get('x-base-url') || (provider === 'openai' ? 'https://api.openai.com' : 'https://api.anthropic.com')
  const apiKey = req.headers.get('x-api-key')

  // Build target URL
  const base = baseUrl.replace(/\/+$/, '')
  const targetUrl = provider === 'openai'
    ? (base.includes('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`)
    : (base.endsWith('/v1') ? `${base}/messages` : `${base}/v1/messages`)

  // Build upstream headers
  const upstreamHeaders = { 'Content-Type': 'application/json' }
  if (provider === 'openai') {
    upstreamHeaders['authorization'] = `Bearer ${apiKey}`
  } else {
    upstreamHeaders['x-api-key'] = apiKey
    upstreamHeaders['anthropic-version'] = '2023-06-01'
  }

  const body = await req.text()

  const upstream = await fetch(targetUrl, {
    method: 'POST',
    headers: upstreamHeaders,
    body,
  })

  // Pipe upstream response directly (supports SSE streaming)
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    },
  })
}
