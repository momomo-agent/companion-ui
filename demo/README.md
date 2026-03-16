# Companion UI Demo

Single-file prototype of conversation-driven generative UI.

## Quick Start

This demo uses the agentic-lite server at `/api/ask`. Run it from the agentic-lite project:

```bash
cd ~/LOCAL/momo-agent/projects/agentic-lite
# Start the server (if not already running)
# Then open: http://localhost:PORT/demo/index.html from companion-ui

# OR create a symlink:
ln -s ~/LOCAL/momo-agent/projects/companion-ui/demo/index.html demo/companion.html
# Then open: http://localhost:PORT/demo/companion.html
```

## Usage

1. Click the gear icon (⚙️) in the chat panel
2. Enter your API key (Anthropic or OpenAI)
3. Start chatting

The AI will automatically render visual components on the Canvas when appropriate.

## Canvas Components

- **movie-card**: Movie recommendations with ratings
- **progress-card**: Task progress with status
- **text-highlight**: Important quotes or messages
- **code-block**: Code snippets with syntax highlighting

## Example Prompts

- "Recommend a sci-fi movie"
- "Show me a progress bar at 75%"
- "Highlight this: The future is already here"
