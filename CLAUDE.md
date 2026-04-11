# CLAUDE.md — Dreamzy Backend

## What is this project?

Dreamzy is an AI-powered personalized children's story generator. Parents enter their child's name, age, and interests, and the backend orchestrates **story writing** (Claude), **illustration generation** (Google Gemini), **voice narration** (ElevenLabs), and **PDF export** into a single cohesive storybook experience.

The frontend lives in a separate repo and is deployed on Vercel at `dreamzy.xyz`. This backend is deployed on **Railway**.

## Architecture overview

This is a **single-file Node.js/Express server** (`server.js`, ~1,370 lines). All logic — routes, AI orchestration, image generation, voice synthesis, email templates, PDF generation — lives in this one file. There is no `src/` directory, no controllers, no models, no middleware files.

### Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (ES modules, `"type": "module"`) |
| Framework | Express.js |
| AI Story Generation | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Image Generation | Google Gemini 2.5 Flash (REST API via axios) |
| Voice Narration | ElevenLabs (TTS API via axios) |
| Database | Supabase (Postgres) |
| File Storage | Supabase Storage (`story-images` bucket) |
| Payments | Lemon Squeezy (webhooks) |
| Email | Resend (`stories@dreamzy.xyz`) |
| PDF | pdf-lib |

## Running locally

```bash
npm install
npm run dev    # starts with --watch for hot reload
```

Production: `npm start` (plain `node server.js`).

The server listens on `PORT` (default `8080`) at `0.0.0.0`.

### Required environment variables

```
PORT=8080
ANTHROPIC_KEY=           # Claude API key
SUPABASE_URL=            # Supabase project URL
SUPABASE_ANON_KEY=       # Supabase anon/public key
SUPABASE_SERVICE_KEY=    # Supabase service role key (admin ops)
RESEND_API_KEY=          # Resend email service
GEMINI_KEY=              # Google Gemini API key
ELEVENLABS_KEY=          # ElevenLabs TTS API key
LEMONSQUEEZY_WEBHOOK_SECRET=  # HMAC verification for payment webhooks
CRON_SECRET=             # Protects cron job endpoints
FRONTEND_URL=https://dreamzy.xyz

# Lemon Squeezy checkout URLs (one per plan/billing cycle)
LEMONSQUEEZY_FAMILY_MONTHLY_URL=
LEMONSQUEEZY_FAMILY_YEARLY_URL=
LEMONSQUEEZY_FAMILYPLUS_MONTHLY_URL=
LEMONSQUEEZY_FAMILYPLUS_YEARLY_URL=
LEMONSQUEEZY_CLASSROOM_BASIC_MONTHLY_URL=
LEMONSQUEEZY_CLASSROOM_BASIC_YEARLY_URL=
LEMONSQUEEZY_CLASSROOM_PRO_MONTHLY_URL=
LEMONSQUEEZY_CLASSROOM_PRO_YEARLY_URL=
```

There is no `.env.example` file. The variables above are derived from `process.env` usage in `server.js`.

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET /` | Health check — returns `{ status, version }` |
| `POST /preview-story` | Quick 300-token story preview (title, synopsis, hook) |
| `POST /generate-full-story` | Full story pipeline: Claude story + Gemini images + ElevenLabs voice |
| `POST /regenerate-audio` | Re-generate narration for pages (e.g., different narrator) |
| `POST /regenerate-sfx` | Re-generate sound effects for tappable elements |
| `POST /webhook/lemonsqueezy` | Payment webhook (HMAC-verified) |
| `POST /share-story` | Create a shareable story link |
| `GET /share/:shareId` | Retrieve a shared story (increments view counter) |
| `POST /generate-pdf` | Export a story as a downloadable PDF |
| `POST /send-weekly-recap` | Cron job: weekly email digest (requires `x-cron-secret` header) |
| `POST /send-bedtime-reminders` | Cron job: bedtime reminder emails (requires `x-cron-secret` header) |
| `GET /narrators` | List available voice narrators |
| `GET /checkout-urls` | Return Lemon Squeezy checkout URLs for all plans |

## Supabase database tables

- **`profiles`** — User accounts: `id`, `email`, `subscription_status`, `plan`, `trial_ends_at`, `lemon_squeezy_customer_id`, `streak_count`, `last_story_date`, `bedtime_reminder`, `bedtime_reminder_name`
- **`generations`** — Story generation records with progress tracking: `id`, `user_id`, `title`, `child_name`, `age`, `status`, `progress` (0-100), `pages` (JSON), `language`, `lesson`, `goal`, `progress_level`, `series_id`, `episode`, `story_summary`, `characters`
- **`stories`** — Completed/saved stories: `user_id`, `title`, `child_name`, `created_at`, `pages`
- **`shared_stories`** — Shareable links: `id`, `user_id`, `title`, `pages`, `views`, `expires_at` (30 days)

**Storage bucket:** `story-images` — uploaded JPEGs, organized as `{genId}/page-{index}.jpg`

Schema is managed via the Supabase dashboard (no migration files in this repo).

## Key domain concepts

### Age system

Seven age groups with dramatically different writing styles:
- `0-1` (Infants): 1-2 words per page, sensory, no plot
- `1-2` (Toddlers): 1-3 words, repetition, routines
- `3-4` (Preschool): Rhyme/rhythm, simple arc, humor
- `4-5` (Pre-K): Real plot, strong characters, dialogue
- `5-6` (Kindergarten): Fuller narrative, emotional depth
- `6-8` (Early Reader): Strong arc, character growth, wit
- `8-10` (Reader): Complex plot, subplots, deep character arcs

`resolveAge()` normalizes age group strings (e.g., `"3-4"`) to numeric values.

### Page blueprint system

`getPageBlueprint()` generates a rigid page-by-page structure (Setup -> Problem -> Attempts -> Resolution -> Ending) based on page count. This prevents Claude from producing truncated arcs. Each age group has a default page count (5-8 pages).

### Story modes

- **`bedtime`** — Slow, calming, soothing narration
- **`silly`** — Chaotic, laugh-out-loud, expressive narration
- **`daytime`** — Energetic, adventurous, action-driven narration

Voice settings (ElevenLabs stability/style parameters) change per mode and age.

### Lesson system

Two types of lessons:
1. **Concept lessons** (letters, numbers, colors, shapes, routines, body, food, animals) — structural integration where each page teaches one concept
2. **Behavioral/value lessons** (any freeform string like "sharing", "courage") — adaptive narrative arcs with three progression levels:
   - **Introduction** (level 1): Guide models the lesson for the child
   - **Growing** (level 2): Child tries with some help
   - **Hero** (level 3+): Child succeeds independently

### Illustration styles

10 styles defined in `STYLE_PROMPTS`: `cartoon`, `watercolor`, `whimsical`, `vintage`, `line`, `realistic`, `abstract`, `moody`, `wimmelbuch`, `manga`.

### Language support

6 languages in `LANGUAGE_CONFIG`: English (`en`), Spanish Spain (`es_es`), Spanish Latin America (`es_la`), French (`fr`), Portuguese Brazil (`pt`), German (`de`). Each has cover phrases, translation instructions, and sleep-word regex patterns.

### Narrators

4 ElevenLabs voices: `rachel` (default, warm/calm), `matilda` (gentle/friendly), `bill` (warm/deep), `callum` (fun/energetic). English uses `eleven_turbo_v2_5`; other languages use `eleven_multilingual_v2`.

### Series / Continuations

Stories can be part of a series (`series_id`, `episode`). Continuation stories reference previous episode context, carry forward characters, and maintain the same lesson theme through new scenarios.

### Subscription plans

`free` (7-day trial), `family`, `family_plus`, `classroom_basic`, `classroom_pro`. Family Plus unlocks tappable sound effects for ages 0-4.

## Story generation pipeline (`POST /generate-full-story`)

1. Create a `generations` record in Supabase (progress: 0%)
2. Generate story JSON via Claude (progress: 15%)
3. Apply appearance override if provided
4. Replace sleep-word endings via `improveEnding()`
5. Generate cover image via Gemini + upload to Supabase Storage (progress: 20%)
6. Generate cover narration via ElevenLabs
7. Generate page images sequentially with world-description consistency anchoring (progress: 20-65%)
8. Generate page narration (progress: 70-95%)
9. Generate sound effects if Family Plus + age <= 4
10. Update `generations` record with completed story (progress: 100%)
11. Send confirmation email if `userEmail` provided
12. Return full story JSON to client

## Retry & error handling patterns

- **Anthropic 529 (overloaded):** Retry up to 3 times with increasing delays (10s, 20s, 30s) via `generateStoryWithRetry()`
- **Gemini 429 (rate limit):** Retry up to 3 times with 10s delay
- **ElevenLabs 429 (rate limit):** Retry up to 3 times with 15s/30s/60s delays
- **Image generation failure:** Returns `null`, frontend shows placeholder
- **Voice generation failure:** Returns `null`, frontend skips narration for that page
- **JSON parse failure:** Falls back to extracting last valid JSON brace

## Authentication model

- **No JWT/token validation on most endpoints** — the frontend (authenticated via Supabase Auth) passes `userId` in request bodies
- **Cron endpoints:** Protected by `x-cron-secret` header matching `CRON_SECRET` env var
- **Webhook:** HMAC-SHA256 signature verification (`x-signature` header)
- Two Supabase clients: `supabase` (anon key, reads) and `supabaseAdmin` (service key, writes)

## Code conventions

- **ES modules** — `import`/`export`, not `require()`
- **No TypeScript** — plain JavaScript
- **No linter/formatter config** — no ESLint, Prettier, or similar
- **No test framework** — no automated tests
- **Console logging** for observability — `console.log` for progress, `console.error` for failures
- **Inline HTML email templates** — no template engine
- **Sequential image generation** — images are generated one at a time (not parallel) to maintain visual consistency via `worldDescription` anchoring
- **Images stored as Supabase Storage URLs** — never base64 in the database
- **Audio returned as base64 data URIs** — not stored, only sent to client in the response

## CORS origins

Configured for: `dreamzy.xyz`, `www.dreamzy.xyz`, `localhost:5173`, and the Vercel preview deployment URL.

## Files in the repo

- `server.js` — The entire backend application
- `package.json` — Dependencies and scripts
- `package-lock.json` — Lockfile
- `.gitignore` — Ignores `node_modules`, `.env`, `.env.*`
- `fix*.py` — One-off database migration/fix scripts (not part of the running application)
- `test.pdf` — Test artifact

## Guidelines for AI assistants

- **All changes go in `server.js`** — there is no module structure to maintain
- **Preserve the single-file architecture** unless explicitly asked to refactor
- **Never store base64 image data in Supabase tables** — always upload to Storage and use public URLs
- **Keep illustration prompts in English** even when the story language is different (Gemini needs English prompts)
- **Maintain the page blueprint system** — it's critical for story quality; don't simplify or remove it
- **Respect age-appropriate writing rules** — the age style instructions are carefully tuned
- **Test with `npm run dev`** — uses `--watch` for automatic reload
- **Environment variables are secrets** — never log them or include them in responses
- **The `fix*.py` scripts are throwaway** — don't modify or build on them
