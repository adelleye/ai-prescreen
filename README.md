# Juno Quick Screen

**Adaptive AI Pre-Screening for Recruiters**

Juno Quick Screen is an AI-powered pre-screening tool that automatically evaluates job candidates through conversational interviews. Each candidate receives a short, adaptive test powered by a large language model that adjusts questions in real-time based on responses.

## What It Does

- 🤖 **AI-Powered Interviews**: Conversational chat interface that asks job-specific questions
- ⚡ **Fast Evaluation**: ~15 minutes per candidate, no manual grading needed
- 📊 **Instant Reports**: Get scores for competence, integrity, and communication
- 🔒 **Secure & Mobile-Friendly**: Works on any device, no special setup required

## Prerequisites

Before you begin, make sure you have:

- **Node.js** (v18.20.0 or higher)
- **pnpm** package manager
- **PostgreSQL database** (see setup options below)
- **OpenAI API key** (for AI scoring)

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Database

**Option A: Docker (Easiest)**

```bash
./setup-database.sh
```

**Option B: Cloud Database (Free)**

1. Sign up at [Neon.tech](https://neon.tech) (free tier)
2. Create a new project
3. Copy the connection string

### 3. Configure Environment

Create `apps/api/.env`:

```bash
# Database (from step 2)
DATABASE_URL=postgres://user:password@localhost:5432/ai_prescreen

# OpenAI API Key (REQUIRED)
LLM_API_KEY=sk-your-openai-api-key-here

# Security Keys (generate random strings)
JWT_SECRET=$(openssl rand -hex 32)
PII_ENCRYPTION_KEY=$(openssl rand -base64 32)

# App URLs
WEB_BASE_URL=http://localhost:3000
LLM_BASE_URL=https://api.openai.com
LLM_MODEL_PRIMARY=gpt-4o-mini
LLM_TIMEOUT_MS=12000
PORT=4000
```

### 4. Run Database Migrations

```bash
cd apps/api
pnpm migrate
```

### 5. Start the Application

**Terminal 1 - API Server:**
```bash
cd apps/api
pnpm dev
```

**Terminal 2 - Web Server:**
```bash
cd apps/web
pnpm dev
```

### 6. Test It Out

Create a test assessment:
```bash
curl -X POST http://localhost:4000/dev/test-assessment \
  -H "Content-Type: application/json" \
  -d '{"jobId": "finance-ap"}'
```

Open the `testUrl` from the response in your browser.

## Project Structure

```
ai-prescreen/
├── apps/
│   ├── api/          # Backend API server
│   └── web/          # Next.js frontend
├── packages/
│   ├── shared/       # Shared utilities
│   ├── ui/           # UI components
│   └── config/       # Shared configs
```

## Tech Stack

- **Backend**: Fastify, TypeScript, PostgreSQL
- **Frontend**: Next.js, React, Tailwind CSS
- **AI**: OpenAI GPT-4
- **Package Manager**: pnpm workspaces

## License

MIT

