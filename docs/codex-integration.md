# Codex integration decision

Verified 18 November 2026. Local environment has the ChatGPT-bundled Codex CLI, Node 23.11 and npm 10.9. No credentials, private rollout files or conversation contents were read, and no paid Codex task was launched.

## Documented source

[Official non-interactive mode documentation](https://developers.openai.com/codex/noninteractive) documents `codex exec --json` JSONL events including `thread.started`, `turn.started`, `turn.completed`, failures and item events. The completed-turn example contains `usage.input_tokens`, `cached_input_tokens`, `output_tokens` and `reasoning_output_tokens`. Cache is a subset of input; reasoning is a subset of output. Only input + output is totaled. Missing subcategories remain absent.

`CodexAdapter` imports only completed usage from an explicitly selected capture. All other events and prompt/code/command fields are discarded in memory. This is **measured imported usage for that capture**, not a live account-wide meter. Failed turns without usage are not guessed; incomplete captures can undercount.

The documented example provides neither timestamps nor turn IDs. Stable identity is thread ID + completed-turn ordinal within a **complete unmodified capture**. Reimporting the same capture is idempotent; extending that same capture preserves IDs. Do not concatenate resumed captures or import fragments starting mid-thread: ordinals can overlap. For resumptions/alternate producers use normalized metadata with genuine producer-assigned stable IDs. Same-ID partial counters are completed using monotonic maxima, never additive deltas. Provenance, date and session cannot change for an existing identity. Non-monotonic corrections require replacing the dataset, not adding another event.

Missing timestamps use an explicitly unknown-date sentinel `1970-01-01T00:00:00.000Z`; this does NOT assert the usage occurred in 1970. Such records count toward session and retained lifetime, not today's UTC window. Producer `timestamp` is honored when present; import time is never substituted. Origin and provenance are retained per event. Imported provenance is a producer declaration, not cryptographic authentication.

## Other surfaces

Available tools in this environment do not expose a documented complete token feed for this desktop chat. No cross-client desktop/IDE usage hook or embedded UI extension point was established. Tokenfall is therefore a separate local browser companion. We did not implement SDK/app-server/hook clients; such clients could instrument conversations they own, not automatically every existing desktop conversation. This is a scope decision, not a claim that Codex has no APIs. No private-data fallback is used.

To collect usage, deliberately run your own `codex exec --json "your task"`. That task consumes tokens; JSONL items can include sensitive contents. Pipe through the included `scripts/usage-only.mjs` filter to save only counters. Tokenfall itself never starts Codex or collects credentials.

## Technical choices

Vite/React/TypeScript shell; seeded independent simulation with fixed 200 ms ticks. Canvas 2D replaces PixiJS: the bounded 24 residents, 15 buildings and procedural terrain need no GPU library or external sprite assets. Rendering is independent of React and the engine; sprites never update via React each frame. All artwork is original procedural code.

IndexedDB schema v1 stores full world state, ties, memories, departures, settings and usage IDs. Unsupported versions fail explicitly instead of guessing a migration; future releases must introduce explicit migrations. Autosave every five seconds and on visibility change; storage failure is reported. Offline catch-up is limited to 300 ticks (60 simulation seconds) with demo usage disabled during catch-up. Replay resumes afterward.

## Modes and recovery

Default provenance is DEMO; tokens appear only after deliberate demo/replay input. Mixed measured/demo/estimated data have a mixed badge and source subtotals. Session counts the selected session; New session creates a new world only in session scenario, preserving a previous-session summary. Daily scenario uses UTC usage dates while retaining the town. Persistent scenario uses retained lifetime usage. “Lifetime” is not lifetime account usage.

Pressure: `clamp(clamp(100*(selectedTokens/budget)^curve)-relief)` smoothed by 0.012/tick. Thresholds, curve and budget are fictional adjustable presets. Cache/reasoning never count again. Reliable model attribution is unavailable in the documented source, so no fake model filter is offered.

After 100 ticks without new usage, relief rises by `0.025 + cooperation*0.00015` each tick, bounded at 100. Mutual aid adds 12 relief, 8 water and 6 cooperation, bounded. This is fictional recovery, not ecological offsetting. Recovery works even far above budget. Departed residents remain in history without spontaneously returning. Changing scenario clears relief.

Metadata retention is explicit pruning at 7/30/90 days: automatic removal of event IDs would silently break idempotency. Pruning changes retained historical totals as the UI explains; reimporting a pruned event counts it anew. Caps: 20,000 events, 160 chronicle entries, 24 memories/person, 20 session summaries. Full prior worlds require user exports, not unlimited snapshots.

## Honest vertical-slice boundaries

Implemented: animated procedural terrain/water/crops, named people, schedules, walking routes, personal needs, ties/favors/sharing/arguments/repairs, crop losses, departures, inspectors, chronicle, narrative camera, navigation/speeds, reduced motion, persistence, demo/replay and manual measured import.

Not implemented: automatic desktop telemetry, real environmental accounting, audio, heat shimmer, full family/debt economics, collision avoidance, automatic resident return, full-world archive browser. Paths use shared lanes and local approaches. Weather/wildlife are lightweight visual systems. This is a runnable vertical slice, not every optional idea in the brief.

Dated normalized replay is also supported: select “Rejouer des événements datés — JSON”. Events are validated atomically, sorted by source timestamps and scheduled on simulation ticks with their original intervals, at most 100 events per tick. Queue/cursor are persisted. The playback button stops this replay. Offline catch-up pauses its usage clock; a fresh session clears the queue. Ordinary normalized import intentionally applies counters immediately. The demo button and `public/demo-replay.json` cover the same reproducible progression.

New usage consumes accumulated fictional relief proportionally to tokens/budget, so a previously idle town still responds when consumption resumes. Walking uses a bounded obstacle-aware grid and bridge crossings; residents dwell at destinations to drink, eat, work or rest. People are not collision obstacles for each other. UI publishes immutable world snapshots at 2.5 Hz while the canvas renders independently.

Apocalypse extension: persistent bounded fires, fights and monsters now affect buildings, health, morale and trust. Obstacle-aware fleeing and stationary combat are covered by regression tests. Rendering adds flames, smoke, embers, horns, ash, cracks and rubble.
