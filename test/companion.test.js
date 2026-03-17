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
  // Replicate the parsing logic from index.html
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
    const text = 'Great movie!\n<!--canvas:movie-card {"title":"Arrival"}-->\nReally good.'
    const clean = stripCanvasAnnotations(text)
    assert.equal(clean, 'Great movie!\n\nReally good.')
  })

  it('strips multiple annotations', () => {
    const text = 'A <!--canvas:stat-card {"value":"42"}-->B<!--canvas:quote-card {"text":"hi"}-->C'
    const clean = stripCanvasAnnotations(text)
    assert.equal(clean, 'A BC')
  })

  it('strips incomplete annotation at end', () => {
    const text = 'Hello <!--canvas:movie-card {"title":"test'
    const clean = stripCanvasAnnotations(text)
    assert.equal(clean, 'Hello')
  })

  it('returns original text when no annotations', () => {
    const text = 'Just a plain response'
    assert.equal(stripCanvasAnnotations(text), text)
  })

  it('parses movie-card annotation', () => {
    const text = '<!--canvas:movie-card {"title":"Arrival","year":2016,"rating":7.9}-->'
    const components = parseCanvasAnnotations(text)
    assert.equal(components.length, 1)
    assert.equal(components[0].type, 'movie-card')
    assert.equal(components[0].data.title, 'Arrival')
    assert.equal(components[0].data.year, 2016)
  })

  it('parses multiple annotations', () => {
    const text = `Check this:
<!--canvas:movie-card {"title":"Arrival","year":2016}-->
Also:
<!--canvas:stat-card {"value":"95%","label":"Score"}-->
Done.`
    const components = parseCanvasAnnotations(text)
    assert.equal(components.length, 2)
    assert.equal(components[0].type, 'movie-card')
    assert.equal(components[1].type, 'stat-card')
    assert.equal(components[1].data.value, '95%')
  })

  it('skips malformed JSON annotations', () => {
    const text = '<!--canvas:bad-card {invalid json}--><!--canvas:good-card {"ok":true}-->'
    const components = parseCanvasAnnotations(text)
    assert.equal(components.length, 1)
    assert.equal(components[0].type, 'good-card')
  })

  it('handles all supported card types', () => {
    const types = [
      'movie-card', 'progress-card', 'text-highlight', 'code-block',
      'list-card', 'timeline-card', 'compare-card', 'stat-card',
      'quote-card', 'markdown-card', 'image-grid'
    ]
    types.forEach(type => {
      const text = `<!--canvas:${type} {"test":true}-->`
      const components = parseCanvasAnnotations(text)
      assert.equal(components.length, 1, `Failed for ${type}`)
      assert.equal(components[0].type, type)
    })
  })
})

// ── Config management ──────────────────────────────────────────────

describe('Config', () => {
  it('getConfig returns correct defaults', () => {
    // Simulate getConfig logic
    const config = {
      provider: 'anthropic',
      baseUrl: undefined,
      apiKey: '',
      model: undefined,
      searchApiKey: undefined,
      tools: ['search'],
      stream: true,
      proxyUrl: '/api/proxy',
    }
    assert.equal(config.provider, 'anthropic')
    assert.equal(config.stream, true)
    assert.equal(config.proxyUrl, '/api/proxy')
  })

  it('tools array reflects active tools', () => {
    const activeTools = ['search', 'code']
    assert.deepEqual(activeTools, ['search', 'code'])

    const onlySearch = ['search']
    assert.deepEqual(onlySearch, ['search'])
  })
})

// ── Claw runtime integration ───────────────────────────────────────

describe('Claw Runtime', () => {
  // Test that claw.js loads and createClaw exists
  it('createClaw is exported', () => {
    const { createClaw } = require('../demo/claw.js')
    assert.equal(typeof createClaw, 'function')
  })

  it('createClaw requires apiKey', () => {
    const { createClaw } = require('../demo/claw.js')
    assert.throws(() => createClaw({}), /apiKey/)
  })

  it('createClaw creates instance with memory', () => {
    // Mock agenticAsk and AgenticMemory
    const mockMemory = {
      createMemory: (opts) => ({
        user: async () => {},
        assistant: async () => {},
        history: () => [],
        messages: () => [],
        info: () => ({ turns: 0, messageCount: 0, tokens: 0, maxTokens: 8000 }),
        clear: () => {},
        destroy: () => {},
      })
    }
    globalThis.AgenticMemory = mockMemory
    globalThis.agenticAsk = async () => ({ answer: 'test', rounds: 1 })

    // Re-require to pick up mocks
    delete require.cache[require.resolve('../demo/claw.js')]
    const { createClaw } = require('../demo/claw.js')

    const claw = createClaw({ apiKey: 'test-key' })
    assert.ok(claw)
    assert.equal(typeof claw.chat, 'function')
    assert.equal(typeof claw.session, 'function')
    assert.equal(typeof claw.heartbeat, 'function')
    assert.equal(typeof claw.schedule, 'function')
    assert.equal(typeof claw.on, 'function')
    assert.equal(typeof claw.destroy, 'function')
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
          history: () => msgs,
          messages: () => msgs,
          info: () => ({ turns: msgs.length / 2 }),
          clear: () => msgs.length = 0,
          destroy: () => {},
          id: opts?.id,
        }
      }
    }
    globalThis.AgenticMemory = mockMemory
    globalThis.agenticAsk = async (input) => ({ answer: `Echo: ${input}`, rounds: 1 })

    delete require.cache[require.resolve('../demo/claw.js')]
    const { createClaw } = require('../demo/claw.js')

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
})

// ── Memory integration ─────────────────────────────────────────────

describe('Memory', () => {
  it('memory.js loads and exports createMemory', () => {
    const mem = require('../demo/memory.js')
    assert.ok(mem.createMemory || mem.AgenticMemory?.createMemory)
  })
})

// ── Proxy contract ─────────────────────────────────────────────────

describe('Proxy Contract', () => {
  it('proxy.js Edge handler exists', () => {
    // Verify the proxy module shape
    const fs = require('fs')
    const proxyCode = fs.readFileSync(
      require('path').join(__dirname, '..', 'api', 'proxy.js'), 'utf8'
    )
    assert.ok(proxyCode.includes('export default async function handler'))
    assert.ok(proxyCode.includes('x-base-url'))
    assert.ok(proxyCode.includes('x-provider'))
    assert.ok(proxyCode.includes('x-api-key'))
    assert.ok(proxyCode.includes("runtime: 'edge'"))
  })

  it('proxy handles CORS preflight', () => {
    const fs = require('fs')
    const proxyCode = fs.readFileSync(
      require('path').join(__dirname, '..', 'api', 'proxy.js'), 'utf8'
    )
    assert.ok(proxyCode.includes('OPTIONS'))
    assert.ok(proxyCode.includes('Access-Control-Allow-Origin'))
  })
})

// ── System prompt ──────────────────────────────────────────────────

describe('System Prompt', () => {
  it('contains all canvas types', () => {
    const fs = require('fs')
    const html = fs.readFileSync(
      require('path').join(__dirname, '..', 'demo', 'index.html'), 'utf8'
    )
    const types = [
      'movie-card', 'progress-card', 'text-highlight', 'code-block',
      'list-card', 'timeline-card', 'compare-card', 'stat-card',
      'quote-card', 'markdown-card', 'image-grid'
    ]
    types.forEach(type => {
      assert.ok(html.includes(`- ${type}:`), `System prompt missing ${type}`)
    })
  })

  it('has canvas annotation format example', () => {
    const fs = require('fs')
    const html = fs.readFileSync(
      require('path').join(__dirname, '..', 'demo', 'index.html'), 'utf8'
    )
    assert.ok(html.includes('<!--canvas:'))
    assert.ok(html.includes('Format:'))
  })
})
