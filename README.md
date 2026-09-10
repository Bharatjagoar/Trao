# AI Interview Prep Kit

Turns a job description + a company URL into a structured, editable interview
preparation kit: a company brief, a role breakdown, a categorised question
bank, flashcards, and a day-by-day study schedule.

## Live deployment

- **App**: http://140.245.244.19:8080/
- **API docs (Swagger UI)**: http://140.245.244.19:8080/api/docs/
- **OpenAPI spec (JSON)**: http://140.245.244.19:8080/api/docs.json

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind CSS 4, JavaScript |
| Backend | Node.js + Express, JavaScript |
| Database | MongoDB (Mongoose) |
| LLM | Google Gemini (`gemini-3.5-flash-lite`), via `@google/generative-ai` |
| Search | Tavily (public interview-discussion search) |
| Scraping | `fetch` + `cheerio`, hand-rolled crawler and robots.txt parser |
| Auth | Session cookie signed with a JWT, `bcryptjs` for password hashing |
| Tests | Vitest |
| API docs | Swagger UI / OpenAPI 3, generated from JSDoc annotations on the routes |

This matches the brief's preferred stack, so no substitution needed. LLM
provider: **Gemini** was chosen over other free-tier options because its
JSON mode (`responseMimeType: "application/json"`) is reliable. Model:
**`gemini-3.5-flash-lite`** specifically, over the full-size flash models —
on the free tier, every non-Lite Gemini flash model (2.5, 3, 3.5, 3.6, 3.7,
3.8 Flash) is capped at just 20 requests/day, while the Lite variants get
500/day at a higher RPM too. A single kit generation makes 6-9 Gemini calls
(extraction, brief, per-category questions, gap-fill, flashcards), so the
20 RPD tier allows only ~2 kit generations a day before every request fails
with `RATE_LIMITED` — nowhere near enough to run the batch CLI's 5-case
evaluation, let alone everyday use. The Lite tier's 500 RPD comfortably
covers that.
Search provider: **Tavily** was chosen because it's built for LLM pipelines
(returns clean, pre-summarized results rather than raw SERPs) and has a
1,000-query/month free tier with no card required.

## Repository layout

```
apps/
  api/   Express backend, the research+generation pipeline, and the batch CLI
  web/   Next.js frontend
```

## Setup — local

1. `npm install` from the repo root (installs both workspaces).
2. Copy `apps/api/.env.example` to `apps/api/.env` and fill in:
   - `GEMINI_API_KEY` — from [aistudio.google.com](https://aistudio.google.com)
   - `TAVILY_API_KEY` — from [tavily.com](https://tavily.com)
   - `MONGODB_URI` — a local `mongod`, or a free MongoDB Atlas M0 cluster
   - `JWT_SECRET` — any long random string
3. Copy `apps/web/.env.example` to `apps/web/.env.local` (defaults already
   point at `http://localhost:4000`).
4. Run the backend: `npm run dev:api` (listens on port 4000).
5. Run the frontend: `npm run dev:web` (listens on port 3000).
6. API docs are served by the backend itself at `http://localhost:4000/api/docs/`
   (Swagger UI) and `http://localhost:4000/api/docs.json` (raw OpenAPI spec) —
   no separate setup needed.

## Setup — deployed

Both apps run on a single Ubuntu VM behind nginx, rather than split across
Vercel/Render — simpler to operate for a box that already had no domain name,
just a bare IP with one open port.

- **nginx** listens on `:8080` and reverse-proxies by path: `/api/*` to the
  Express API on `127.0.0.1:4000`, everything else to the Next.js app on
  `127.0.0.1:3000`. This keeps frontend and backend same-origin, so the
  session cookie works over plain HTTP without `SameSite=None`/`Secure`
  (there's no TLS cert for a bare IP without a domain).
- **Backend**: `apps/api`, run as a systemd service (`node src/index.js`, no
  build step needed since it's plain JS). Env vars: `GEMINI_API_KEY`,
  `TAVILY_API_KEY`, `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `NODE_ENV`.
- **Frontend**: `apps/web`, built once (`npm run build`) then run as a
  systemd service (`next start -p 3000 -H 127.0.0.1`). `NEXT_PUBLIC_API_URL`
  is baked in at build time, so it must be set before building.
- **Database**: MongoDB Community Edition installed natively on the same VM
  (`mongod`, systemd-managed) rather than Atlas, since the box had no
  existing database and this avoids an external dependency.
- Both `trao-api` and `trao-web` are `systemctl enable`d, so they come back
  automatically on reboot.

`NODE_ENV=production` matters beyond convention here: it switches the
session cookie to `SameSite=None; Secure`, which is required once the
frontend and backend are on different origins, and it makes the SSRF guard
in `security/urlValidation.js` reject private/loopback addresses (see
Security below).

## Environment variables

Each app has its own `.env.example` documenting exactly what it needs —
`apps/api/.env.example` and `apps/web/.env.example`. Copy each to `.env`
(`.env.local` for the web app) and fill in the values.

**`apps/api/.env`**

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio key for the Gemini LLM calls |
| `GEMINI_MODEL` | Gemini model id (`gemini-3.5-flash-lite`) |
| `TAVILY_API_KEY` | Tavily key for public interview-discussion search |
| `MONGODB_URI` | MongoDB connection string (local `mongod` or Atlas) |
| `JWT_SECRET` | Signs session JWTs — any long random string |
| `PORT` | Port the Express API listens on |
| `CORS_ORIGIN` | Origin allowed to make credentialed requests (the frontend URL) |
| `NODE_ENV` | `development`/`production` — see note below |

**`apps/web/.env.local`**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the Express API, baked in at build time |

## Batch entry point (Section 9)

From a clean clone, after `npm install`:

```
npm run evaluate -- --input <cases.json> --output <kits.json>
```

This runs from the repo root and forwards through to
`apps/api/src/cli/evaluate.js`, which calls the exact same
`generateKit()` pipeline the web app uses — not a parallel implementation.
Credentials are read from `apps/api/.env` (documented in
`apps/api/.env.example`); no other setup is needed.

The CLI deliberately allows private/loopback company URLs (the Appendix B
fixtures are served from `http://localhost:<port>/...`) — this is a
trusted, offline evaluation harness, not the public API, so that specific
SSRF guard is relaxed only for this entry point (see
`allowPrivateNetworks` in `generateKit`).

Verified locally: ran the command against a small local fixture site
(`http://127.0.0.1:8099`) serving a homepage + a `/careers` page describing
a take-home → system-design → behavioural interview loop, plus a couple of
404s and no `robots.txt`. The crawler found the hiring page purely by
keyword-ranking discovered links (no hardcoded `/careers` path), recorded
the 404s as skipped sources rather than failing the run, and the mention of
"system design round" is what triggers the pipeline's dedicated
system-design question pass (see Sequencing below).

## Architecture

```
apps/web  ── fetch (credentials: include) ──►  apps/api
                                                    │
                                     Express routes (auth, kits)
                                                    │
                                        pipeline/orchestrator.js
                              (the single source of truth for kit generation,
                               used by both the API routes and the batch CLI)
                                                    │
                    ┌───────────────┬───────────────┼───────────────┐
                    │               │               │               │
              retrieval/*      llm/prompts/*   scheduling/*      schema/*
           (crawler, robots,   (Gemini calls,  (deterministic    (zod, the
            fetch, search)      per-step        day allocator     Appendix A
                                 prompts)        + coverage        contract)
                                                  checker)
```

- **`retrieval/`** — `crawler.js` (BFS crawl, keyword-ranked link
  discovery), `pageCleaner.js` (HTML → text via cheerio), `publicDiscussion.js`
  (Tavily), backed by `security/fetchSafe.js` and `security/robots.js`.
- **`llm/`** — a single retry-wrapped Gemini client (`client.js`) and one
  prompt module per pipeline step, each with distinct system instructions.
- **`scheduling/`** — `coverage.js` and `scheduler.js`: pure functions, no
  LLM calls, unit-tested directly.
- **`schema/kitSchema.js`** — the Appendix A contract as a zod schema, plus
  cross-reference validation (dangling `question_ids`, unknown
  `requirement_ids`, duplicate ids, `schedule.days.length !==
  days_available`).
- **`pipeline/orchestrator.js`** — sequences all of the above; see below.
- **`state/kitState.js`** — the generated/edited/pinned model (see Builder
  state below).

## Retrieval approach and sources used

Given only a company URL, the pipeline:

1. Crawls same-origin from the homepage, breadth-first, up to 12 pages.
2. Every discovered link is scored against two keyword lists (hiring-page
   terms like "careers", "handbook", "engineering-blog", "interview"; and
   about-page terms like "about", "mission", "team") — the top-scoring
   unvisited links are queued next. No path is ever hardcoded, per the
   brief's explicit requirement.
3. `robots.txt` is fetched once per host and consulted before every
   request; a disallowed URL is skipped and recorded, not treated as fatal.
   A missing/unreachable `robots.txt` is treated as "allow" (the
   conventional default).
4. Each fetch goes through `security/fetchSafe.js`: SSRF-checked URL,
   `http(s)`-only, restricted content-types, a 2MB cap, and a 10s timeout.
   Requests are spaced ~350ms apart.
5. Independently, `publicDiscussion.js` queries Tavily for
   `"<company> interview process questions experience"` — this covers
   Glassdoor/Blind/Reddit-style public discussion that a same-origin crawl
   would never reach.
6. Every unreachable/disallowed/oversized page is recorded in `warnings`
   and in the CLI's per-case `error`, never silently dropped and never
   treated as fatal for the whole run.

## Sequencing (Section 3 & 4)

`pipeline/orchestrator.js` runs these steps in order, each depending on the
previous step's actual output:

1. **Extract requirements** from the pasted JD (no retrieval needed —
   pasted text is already text).
2. **Crawl the company site** (needs step 1's company context only
   incidentally; runs against the given URL).
3. **Search public discussion** of the interview process, independently.
4. **Generate the company brief** — this call is given both the crawled
   about/hiring text *and* the public-discussion summary, so it only runs
   after both retrieval steps.
5. **Generate questions**, grouped by requirement *kind* (technical /
   behavioural / domain), one Gemini call per kind with category-specific
   instructions — a "5+ years React" requirement and a "mentors juniors"
   requirement never share a prompt. If the hiring-process text mentions
   "system design", a dedicated system-design pass runs over the must-have
   technical requirements — this is the concrete case from the brief where
   what was found about the hiring process changes what gets generated.
6. **Coverage check** (deterministic — `scheduling/coverage.js`, no model
   call): any requirement with zero covering questions is a gap.
7. **Close gaps**: regenerate questions scoped to only the gap
   requirements, then re-check. Capped at 3 passes total — in practice a
   thin JD converges in 1, and 3 is enough headroom for a model that
   occasionally drops a `requirement_ids` reference without looping
   forever on a JD that has no more to give. Any requirements still
   uncovered after 3 passes are reported honestly in `coverage` and in the
   kit's `warnings` rather than papered over.
8. **Flashcards**, generated from the same requirement set.
9. **Schedule allocation** (deterministic — `scheduling/scheduler.js`, no
   model call): arithmetic day-bucketing, described below.
10. **Structural validation** (`schema/kitSchema.js`) before the kit is
    ever returned or saved — an invalid kit is a thrown error, not a
    silently-broken save.

## Schedule allocation

Every question gets a priority score (`difficulty × 10`, `+50` if it covers
a must-have requirement, `+5` for system-design). Questions are sorted by
that score, then split into `daysAvailable` contiguous chunks — day 1 gets
the highest-scoring chunk, so harder/must-have material lands earlier, not
the night before. If there are more days than questions, the extra trailing
days get an empty "Review and consolidation" slot rather than being
dropped, so `schedule.days.length` always equals `days_available` exactly
(1-day and 60-day requests both handled — see `tests/scheduler.test.js`).
Minutes are computed from a difficulty→minutes table and are always
integers, per the brief's "no floats" rule.

## Builder: generated / edited / pinned state

This is the state problem the brief calls out as the hardest one, so it's
worth spelling out precisely. Each kit document stores a `meta` object as a
**sibling** of the Appendix A `kit` object (never inside it, so the
Appendix A structure itself is never polluted with extra fields):

```js
{
  company_brief: { state: "generated" | "edited" },
  schedule:       { state: "generated" | "edited" },
  questions:      { [questionId]: "generated" | "edited" | "pinned" },
  flashcards:     { [flashcardId]: "generated" | "edited" | "pinned" },
}
```

- Editing a question/flashcard inline marks it `edited`.
- A hand-added question/flashcard starts `pinned` (nothing should ever
  silently overwrite something the user typed from scratch).
- The user can also explicitly `pin` a still-`generated` item they like
  without editing its text.
- **Regenerating one question category** (`POST /kits/:id/regenerate`)
  only replaces items in that category whose state is still `generated`.
  Anything `edited` or `pinned` survives untouched — this is exactly the
  brief's requirement that "a question the user wrote or edited by hand
  must survive a regeneration of its category." The requirements that
  category is responsible for are recomputed first (anything of that
  kind, plus anything only covered by a question about to be replaced), so
  coverage is regenerated correctly even though some old questions stick
  around.
- **Company brief and schedule** are single blobs, not collections, so
  "regenerate" replaces them wholesale — but the UI shows a warning first
  if the section had been hand-edited, so a wholesale overwrite is always
  the user's explicit choice, never a surprise.
- Deleting/editing a question also prunes any now-dangling
  `schedule.question_ids` reference and recomputes that day's minutes from
  the remaining questions, so the schedule never points at a question that
  no longer exists, whether or not the schedule itself has been
  hand-edited.
- Regenerating a category rebuilds the schedule automatically only if the
  schedule hasn't been hand-edited; if it has, the category regenerate
  still prunes/recalculates minutes but leaves the user's day layout in
  place, rather than discarding it.

## Practice mode ordering

`GET /kits/:id/practice/next` sorts flashcards by last recorded confidence
ascending, with never-seen cards treated as confidence 0 (i.e. sorted
first). This was chosen over a full spaced-repetition interval scheduler
(SM-2 etc.) because the assessment's practice sessions are short and
interview-prep-specific — a candidate a few days out cares about "what am I
worst at right now", not a multi-week review interval that a real SRS
optimizes for. It's a defensible, easily-testable default; a fuller
interval-based scheduler is a natural extension (see Limitations).

## Edge cases (Section 10)

| Case | Handling |
|---|---|
| Invalid/404/timeout company URL | `security/urlValidation.js` + `fetchSafe.js` reject/report it; recorded as a warning, generation still proceeds with an honest, thin brief |
| No hiring page found | `crawlCompanySite` returns `hiringPageUrl: undefined`; a warning is added; the brief says so rather than inventing a process |
| Two-line JD | `extractRequirements` is instructed to extract only what's explicit; a short requirement list is a valid, expected output, flagged via a warning when very short |
| No public discussion found | `searchPublicDiscussion` returns `found: false`; brief and questions proceed without it, again flagged |
| Invalid/incomplete model JSON | `llm/client.js` attempts a fenced-JSON recovery, then throws `LlmInvalidJsonError`; the batch CLI classifies this as `LLM_INVALID_JSON` and records the case as `failed` rather than crashing the run |
| Rate limit / transient provider failure | `util/retry.js` — exponential backoff with jitter, 4 retries on the LLM client, 2 on search |
| Duplicate submission (same JD + company) | `Kit.makeDedupeKey` + a lookup before creating — a second identical submission returns the existing in-flight/ready kit instead of starting a duplicate generation |
| 1-day / 60-day schedule | `buildSchedule` always emits exactly `daysAvailable` days (see tests) |

**Rate limits, in detail.** Free-tier providers throttle tokens-per-minute,
not just requests-per-minute, so a single content-heavy call can trip the
limit even with few requests — a pipeline that dies on the first 429 is the
most common way to lose points here. `llm/client.js#generateJson` catches
Gemini errors, classifies a `429`/`rate limit`/`quota` message as
`RATE_LIMITED` and a `503`/`overloaded` one as `MODEL_OVERLOADED`, and routes
only those two into `withRetry`. `withRetry` retries up to 4 times with a
delay of `2000ms * 2^attempt` plus up to 250ms of jitter (~2s, 4s, 8s, 16s),
so a rate-limited call backs off and retries instead of failing the kit
outright. Any other error (a real bug, not a transient provider hiccup) is
not retried. If all 4 retries are exhausted, the error propagates up and
that one case is recorded as `failed` — in the batch CLI per Appendix B, or
as a generation failure in the app — rather than the whole run/request
crashing.

## Security (Section 11)

- `security/urlValidation.js`: rejects non-`http(s)` schemes always;
  resolves hostnames via DNS and rejects private/loopback/link-local
  ranges **unless** `allowPrivateNetworks` is explicitly set (only true for
  the batch CLI, per Appendix B's local-fixture requirement — the public
  API server never sets it).
- `security/fetchSafe.js`: content-type allowlist, 2MB body cap enforced
  even if `Content-Length` is absent/wrong, 10s timeout.
- `security/robots.js`: robots.txt is fetched and honored per host.
- **Prompt injection**: every prompt that includes fetched-page or
  pasted-JD text wraps it via `llm/client.js#wrapUntrustedContent`, which
  fences it and explicitly instructs the model to treat it as data, never
  as instructions — both the system prompt and the fence reiterate this,
  since a scraped page or a pasted JD is attacker-controllable text the
  pipeline did not author.

## Known limitations

- No spaced-repetition interval scheduler for practice mode (see above) —
  confidence-weighted ordering only.
- The optional creative feature (Section "Creativity Requirement") was not
  built, to keep the timebox on the required scope — the coverage/gap
  loop, the builder's state model, and the batch CLI's robustness got the
  time instead, since those carry the automated + most of the human-review
  weight.
- Company-name extraction is a simple heuristic (hostname label,
  capitalized) rather than a page-derived name; good enough for the brief
  and prep-kit content, not a general-purpose entity extractor.
- Schedule regeneration after editing a question category only rebuilds
  automatically if the schedule itself hasn't been hand-edited; this is a
  deliberate trade-off documented above, not an oversight.
