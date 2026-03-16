#!/usr/bin/env node
// Lightweight dev server for companion-ui
// Serves static files + proxies /api/ask to agentic-lite

import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { ask } from 'agentic-lite'

const PORT = 3000
const DEMO_DIR = join(import.meta.dirname, '../demo')

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
}

createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  // API endpoint
  if (req.url === '/api/ask' && req.method === 'POST') {
    let body = ''
    for await (const chunk of req) body += chunk
    const { prompt, provider, apiKey, baseUrl, model, tools, searchApiKey, systemPrompt } = JSON.parse(body)

    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })

    const emit = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    try {
      emit('status', { message: 'Starting...' })

      const config = {
        provider: provider || 'anthropic',
        apiKey,
        baseUrl: baseUrl || undefined,
        model: model || undefined,
        tools: tools || [],
        toolConfig: searchApiKey ? { search: { apiKey: searchApiKey } } : undefined,
      }

      // Use ask (no streaming in agentic-lite yet)
      const result = await ask(prompt, config)
      // Emit answer as tokens character by character for streaming effect
      for (const char of result.answer) {
        emit('token', { text: char })
        await new Promise(r => setTimeout(r, 10))
      }
      emit('done', result)
    } catch (err) {
      emit('error', { message: String(err) })
    }
    res.end()
    return
  }

  // Static files
  let filePath = req.url === '/' ? '/index.html' : req.url
  const fullPath = join(DEMO_DIR, filePath)
  if (existsSync(fullPath)) {
    const ext = extname(fullPath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' })
    res.end(readFileSync(fullPath))
  } else {
    res.writeHead(404)
    res.end('Not found')
  }
}).listen(PORT, () => {
  console.log(`Companion UI dev server: http://localhost:${PORT}`)
})
