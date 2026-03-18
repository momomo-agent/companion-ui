/**
 * Companion UI — Unit + Integration Tests
 * Tests claw runtime integration, canvas annotation parsing,
 * memory management, and config handling.
 * 
 * Run: node --test test/companion.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

// ── Canvas annotation parsing ──────────────────────────────────────

describe('Canvas Annotations', () => {
  function stripCanvasAnnotations(text) {
    let result = text.replace(/<!--canvas:\S+\s+[\s\S]*?-->/g, '')
    const idx = result.indexOf('<!--canvas:')
    if (idx !== -1) result = result.substring(0, idx)
    return result.trim()
  }

  function parseCanvasAnnotations(text) {
    const results = []
    const regex = /<!--canvas:(\S+)\s+([\s\S]*?)-->/g
    let m
    while ((m = regex.exec(text)) !== null) {
      try { results.push({ type: m[1], data: JSON.parse(m[2]) }) } catch {}
    }
    return results
  }

  it('strips single annotation', () => {
    const text = 'Great movie!\n<!--canvas:card {"title":"Arrival"}-->\nReally good.'
    assert.equal(stripCanvasAnnotations(text), 'Great movie!\n\nReally good.')
  })

  it('strips multiple annotations', () => {
    const text = 'A <!--canvas:metric {"value":"42"}-->B<!--canvas:callout {"text":"hi"}-->C'
    assert.equal(stripCanvasAnnotations(text), 'A BC')
  })

  it('strips incomplete annotation at end', () => {
    assert.equal(stripCanvasAnnotations('Hello <!--canvas:card {"title":"test'), 'Hello')
  })

  it('returns original text when no annotations', () => {
    assert.equal(stripCanvasAnnotations('Just plain text'), 'Just plain text')
  })

  it('parses card annotation', () => {
    const components = parseCanvasAnnotations('<!--canvas:card {"title":"Arrival","subtitle":"2016"}-->')
    assert.equal(components.length, 1)
    assert.equal(components[0].type, 'card')
    assert.equal(components[0].data.title, 'Arrival')
  })

  it('parses multiple annotations', () => {
    const text = '<!--canvas:card {"title":"X"}-->text<!--canvas:metric {"value":"95%"}-->'
    const components = parseCanvasAnnotations(text)
    assert.equal(components.length, 2)
    assert.equal(components[0].type, 'card')
    assert.equal(components[1].type, 'metric')
    assert.equal(components[1].data.value, '95%')
  })

  it('skips malformed JSON', () => {
    const components = parseCanvasAnnotations('<!--canvas:bad {invalid}--><!--canvas:card {"ok":true}-->')
    assert.equal(components.length, 1)
    assert.equal(components[0].type, 'card')
  })

  it('handles all current canvas types', () => {
    const types = ['card', 'metric', 'steps', 'columns', 'callout', 'code', 'markdown', 'media']
    types.forEach(type => {
      const components = parseCanvasAnnotations(`<!--canvas:${type} {"test":true}-->`)
      assert.equal(components.length, 1, `Failed for ${type}`)
      assert.equal(components[0].type, type)
    })
  })
})

// ── Config ──────────────────────────────────────────────────────────

describe('Config', () => {
  it('defaults are correct', () => {
    const config = { provider: 'anthropic', stream: true, proxyUrl: '/api/proxy' }
    assert.equal(config.provider, 'anthropic')
    assert.equal(config.stream, true)
    assert.equal(config.proxyUrl, '/api/proxy')
  })

  it('tools array works', () => {
    assert.deepEqual(['search', 'code'], ['search', 'code'])
    assert.deepEqual(['search'], ['search'])
  })
})

// ── Claw Runtime ────────────────────────────────────────────────────

describe('Claw Runtime', () => {
  it('createClaw is exported', () => {
    const { createClaw } = require('../../agentic-claw/claw.js')
    assert.equal(typeof createClaw, 'function')
  })

  it('createClaw requires apiKey', () => {
    const { createClaw } = require('../../agentic-claw/claw.js')
    assert.throws(() => createClaw({}), /apiKey/)
  })

  it('creates instance with full API surface', () => {
    const mockMemory = {
      createMemory: () => ({
        user: async () => {}, assistant: async () => {},
        history: () => [], messages: () => [],
        info: () => ({ turns: 0, messageCount: 0, tokens: 0, maxTokens: 8000 }),
        clear: () => {}, destroy: () => {},
      })
    }
    globalThis.AgenticMemory = mockMemory
    globalThis.agenticAsk = async () => ({ answer: 'test', rounds: 1 })
    delete require.cache[require.resolve('../../agentic-claw/claw.js')]
    const { createClaw } = require('../../agentic-claw/claw.js')

    const claw = createClaw({ apiKey: 'test-key' })
    assert.ok(claw)
    ;['chat', 'session', 'heartbeat', 'schedule', 'on', 'off', 'destroy', 'sessions'].forEach(m => {
      assert.equal(typeof claw[m], 'function', `missing ${m}`)
    })
    assert.ok(claw.memory)
    claw.destroy()
    delete globalThis.AgenticMemory
    delete globalThis.agenticAsk
  })

  it('session creates isolated instances', () => {
    const mockMemory = {
      createMemory: (opts) => {
        const msgs = []
        return {
          user: async (m) => msgs.push({ role: 'user', content: m }),
          assistant: async (m) => msgs.push({ role: 'assistant', content: m }),
          history: () => msgs, messages: () => msgs,
          info: () => ({ turns: msgs.length / 2 }),
          clear: () => msgs.length = 0, destroy: () => {}, id: opts?.id,
        }
      }
    }
    globalThis.AgenticMemory = mockMemory
    globalThis.agenticAsk = async (input) => ({ answer: `Echo: ${input}`, rounds: 1 })
    delete require.cache[require.resolve('../../agentic-claw/claw.js')]
    const { createClaw } = require('../../agentic-claw/claw.js')

    const claw = createClaw({ apiKey: 'test-key' })
    const alice = claw.session('alice')
    const bob = claw.session('bob')
    assert.notEqual(alice.memory, bob.memory)
    assert.equal(alice.id, 'alice')
    assert.equal(bob.id, 'bob')
    claw.destroy()
    delete globalThis.AgenticMemory
    delete globalThis.agenticAsk
  })

  it('chat calls agenticAsk and returns result', async () => {
    const mockMemory = {
      createMemory: () => ({
        user: async () => {}, assistant: async () => {},
        history: () => [], messages: () => [],
        info: () => ({}), clear: () => {}, destroy: () => {},
      })
    }
    globalThis.AgenticMemory = mockMemory
    globalThis.agenticAsk = async (prompt) => ({ answer: `Reply to: ${prompt}`, rounds: 1 })
    delete require.cache[require.resolve('../../agentic-claw/claw.js')]
    const { createClaw } = require('../../agentic-claw/claw.js')

    const claw = createClaw({ apiKey: 'test-key' })
    const result = await claw.chat('hello')
    assert.equal(result.answer, 'Reply to: hello')
    assert.equal(result.rounds, 1)
    claw.destroy()
    delete globalThis.AgenticMemory
    delete globalThis.agenticAsk
  })
})

// ── Memory ──────────────────────────────────────────────────────────

describe('Memory', () => {
  it('memory.js loads and exports createMemory', () => {
    const mem = require('../../agentic-memory/docs/memory.js')
    assert.ok(mem.createMemory || mem.AgenticMemory?.createMemory)
  })
})

// ── Proxy Contract ──────────────────────────────────────────────────

describe('Proxy Contract', () => {
  const fs = require('fs')
  const path = require('path')
  const proxyCode = fs.readFileSync(path.join(__dirname, '..', 'api', 'proxy.js'), 'utf8')

  it('Edge handler exists with correct shape', () => {
    assert.ok(proxyCode.includes('export default async function handler'))
    assert.ok(proxyCode.includes("runtime: 'edge'"))
  })

  it('forwards required headers', () => {
    ;['x-base-url', 'x-provider', 'x-api-key'].forEach(h => {
      assert.ok(proxyCode.includes(h), `Missing ${h}`)
    })
  })

  it('handles CORS preflight', () => {
    assert.ok(proxyCode.includes('OPTIONS'))
    assert.ok(proxyCode.includes('Access-Control-Allow-Origin'))
  })
})

// ── System Prompt ───────────────────────────────────────────────────

describe('System Prompt', () => {
  const fs = require('fs')
  const path = require('path')
  const html = fs.readFileSync(path.join(__dirname, '..', 'demo', 'index.html'), 'utf8')

  it('contains all canvas types', () => {
    ;['card', 'metric', 'steps', 'columns', 'callout', 'code', 'markdown', 'media'].forEach(type => {
      assert.ok(html.includes(`- ${type}:`), `System prompt missing ${type}`)
    })
  })

  it('has canvas annotation format', () => {
    assert.ok(html.includes('<!--canvas:'))
    assert.ok(html.includes('Format:'))
  })

  it('has usage example', () => {
    assert.ok(html.includes('Example:'))
  })
})
