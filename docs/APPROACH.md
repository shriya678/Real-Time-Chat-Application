# APPROACH

Living design document. Each feature PR that introduces a new architectural decision appends its rationale here. Locked sections (marked *stable*) will not change unless a scope change requires it.

---

## 1. Overall Implementation Strategy *(stable)*

Deliver the application feature-by-feature, one branch and one PR per feature. Every feature is small enough to be reviewed in isolation and passes its acceptance criteria before merge. This produces a Git history that reads like the story of the build.

The order is bottom-up: backend skeleton → REST → sockets → frontend shell → frontend chat → integration → bonuses → deploy + docs. Each layer is stable before the next lands on top of it.

---

## 2. Tech Stack *(stable)*

### Backend
| Choice | Why | Rejected alternative |
|---|---|---|
| **Node.js 20 (LTS)** | Mature ES module support without flags; required by the assessment. | Node 18: functional but older; Node 22: not yet LTS. |
| **Express 4** | Minimal, well-known, widest documentation; still the industry default. | Fastify: faster but adds a learning curve reviewers may not follow. Express 5: newer but less battle-tested. |
| **Socket.io** | Assessment mandates it. Also gives us rooms, ack semantics, automatic reconnection. | Raw WebSocket: too primitive; the assessment explicitly excludes alternatives. |
| **Mongoose + MongoDB Atlas** | Fast to model, schema validation built-in, hosted free tier. | Sqlite: no cloud persistence on ephemeral Render disks. Postgres: heavier setup without benefit for this data shape. |
| **helmet, cors, morgan** | Production hygiene: security headers, CORS control, request logs. Cheap to include, expensive to forget. | Rolling own: pointless reinvention. |
| **Minimal in-house logger** | ~30 lines, level-aware, swappable. Enough for a take-home. | pino / winston: better in production but extra deps + config we don't need yet. |

### Frontend
| Choice | Why | Rejected alternative |
|---|---|---|
| **React 18** | My strongest stack; widest interview vocabulary. | Vue / Svelte: no prior hands-on experience → higher risk on a 24-hour clock. |
| **Vite** | Instant HMR, native ESM, minimal config. | Create React App: deprecated. Next.js: overkill for a client-rendered chat UI. |
| **axios** | Interceptors, defaults, easy timeout handling. | fetch: fine for one call, cumbersome for a shared client. |
| **socket.io-client** | Direct pair with the server. | Custom WebSocket wrapper: reinvention. |
| **Context + custom hooks** | Fits the scope; no Redux boilerplate. | Redux / Zustand: over-engineered for this state graph. |

### Rejected at top level
| Rejection | Reason |
|---|---|
| React Native | Zero prior exposure on my side; APK build + toolchain would eat 4–6 hours I cannot spare. Web deploy is one command. |
| TypeScript | Adds ~1h of config and typing friction. JavaScript with disciplined naming keeps interview signal without dragging the schedule. |
| A test framework | No time budget; documented smoke tests cover the assessment surface. |

---

## 3. Folder Structure *(stable)*

```
Real-Time-Chat-Application/
├── .github/
│   └── PULL_REQUEST_TEMPLATE.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── config/          # env, db — read once, exported frozen
│       ├── middleware/      # notFound, errorHandler, validation, asyncHandler
│       ├── models/          # Mongoose schemas (Feature 3+)
│       ├── controllers/     # HTTP handlers — thin, delegate to services
│       ├── services/        # business logic — no req/res, pure I/O
│       ├── routes/          # Express routers, one per resource
│       ├── sockets/         # Socket.io handlers (Feature 4+)
│       ├── utils/           # logger, small pure helpers
│       ├── app.js           # Express instance (importable, testable)
│       └── server.js        # HTTP lifecycle, DB connect, graceful shutdown
├── frontend/
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── api/             # axios client + resource-specific calls
│       ├── socket/          # singleton client + typed emit helpers
│       ├── context/         # AuthContext, ChatContext
│       ├── hooks/           # useAuth, useSocket, useChat, useTyping, usePresence, useReadReceipts
│       ├── components/      # LoginScreen, ChatWindow, MessageList, MessageBubble, etc.
│       ├── utils/           # formatTime, receiptIcons
│       ├── styles/          # chat.css
│       ├── App.jsx          # top-level composition
│       └── main.jsx         # React DOM entry
├── docs/
│   ├── REQUIREMENTS.md
│   ├── APPROACH.md
│   └── TECHNICAL_DESIGN.md  # (added in Feature 11)
└── README.md
```

**Why layered?** Each layer has one reason to change. Routes shouldn't need editing when the DB schema changes; services shouldn't care about HTTP status codes. This is the same shape reviewers ship in production Node code, so it reads as fluent architecture.

---

## 4. Configuration Strategy *(stable)*

- **Single source of truth:** `backend/src/config/env.js` reads `process.env` once at startup, validates every required var, and exports a frozen object. Any code that needs a config value imports from this module. Nothing in the codebase touches `process.env` directly.
- **Fail-fast on missing config:** Missing required vars → process exits with a helpful error. Prevents the "app runs but silently uses `undefined`" trap.
- **Environment tiers:** `NODE_ENV=development` (verbose logs, dev CORS) vs `production` (combined access logs, prod CORS). Vite's `import.meta.env` mirrors this on the client, gated to `VITE_` prefix.

---

## 5. Error-Handling Strategy *(stable)*

- **REST:** All controllers wrap with `asyncHandler(fn)` — any thrown or rejected promise flows into the central `errorHandler` middleware, which shapes it into `{ success: false, error: { code, message } }`. No try/catch spam per route.
- **Unknown routes:** A `notFound` middleware returns a 404 JSON body instead of Express's default HTML.
- **Production vs development:** Stack traces are only included in log output during development. Response bodies never leak stacks.
- **Sockets:** Each handler emits a `message:error` (or similar) event back to the sender on failure. Broadcasts are only fired on success.

---

## 6. Messages API Design *(Feature 3)*

### Endpoints

| Method | Path | Purpose | Success | Failure |
|---|---|---|---|---|
| `POST` | `/api/messages` | Create a message | `201` + `{success, data: <message>}` | `400 VALIDATION_ERROR` with per-field `details[]` |
| `GET` | `/api/messages` | Paginated history (chronological) | `200` + `{success, data: {messages, hasMore, nextCursor}}` | `400 INVALID_CURSOR` on malformed `?before` |

Query params on `GET`: `limit?` (1..100, default 50), `before?` (ISO 8601 cursor).

### Layered request flow

For a `POST /api/messages`:

```
Request
   ↓
app-level middleware   →  helmet, cors, express.json, morgan
   ↓
route-level middleware →  validateBody(MESSAGE_BODY_SCHEMA)
   ↓
controller             →  messageController.create   (thin, no logic)
   ↓
service                →  messageService.createMessage
   ↓
model                  →  Message.create
   ↓
MongoDB
   ↓
Response  ←  { success: true, data: <message.toJSON()> }
```

Each layer has one responsibility. Any future change — rate limiting, profanity filtering, per-user quotas — has one obvious home.

### Response envelope

Consistent shape across every endpoint, success or failure:

```json
{ "success": true,  "data": ... }
{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }
```

Frontend can branch on `success` without endpoint-specific parsing. `details` is included only when field-level info exists (validation errors).

### Pagination — cursor over offset

Chose cursor pagination (`?before=<ISO date>`) over offset (`?page=N&limit=50`).

- **Stable during concurrent writes.** The cursor is anchored to a specific message; new messages arriving mid-scroll don't shift what previous requests would return. Offset would cause duplicates or gaps.
- **O(log N) at any depth** thanks to the `{createdAt: -1}` index. Offset requires the DB to scan and discard `N` documents.
- **Natural fit for infinite-scroll UIs.** The browser only needs to remember the oldest visible cursor.

The DB query orders newest-first (fastest with our index) then the service `.reverse()`s in memory so the response array reads chronologically (oldest → newest). Frontend appends new incoming messages to the tail with no special handling.

**Trade-offs acknowledged:**
- No random-page access — irrelevant for a chat feed
- Single-field timestamp cursor could theoretically collide on same-millisecond writes. A production version would use a composite `(createdAt, _id)` cursor as a tie-breaker — flagged as a future improvement.

The `limit + 1` trick reports `hasMore` without a separate `countDocuments()` call — one round-trip to Mongo instead of two.

### Validation — hand-rolled, not zod/joi

Rolled a minimal `validateBody(schema)` middleware factory instead of adopting zod, joi, or express-validator.

- Our surface is 2 endpoints × 2 fields — a library's abstractions are wasted
- Zero extra deps stays consistent with the "minimal in-house logger" precedent
- Returns **all** field errors at once (not fail-fast) — the client sees every problem in one round-trip

**Defense in depth.** The middleware is the first line at the HTTP boundary. The Mongoose schema (`required`, `minLength`, `maxLength`, `trim`) is the second at the DB boundary. Either can fail closed and the other still catches it.

**Swap candidate:** if the schema surface grows (many endpoints, nested shapes, conditional rules), migrate `validate.js` to **zod**. The middleware boundary means only that one file changes — controllers and routes see the same `req.body` contract.

### Message model — persistence design

- **Embedded `readBy` subdoc** (not a separate collection) — receipts are small, only accessed with the parent, and don't need their own lifecycle. Single-query reads.
- **`deliveredAt` defaults to `Date.now()` at create** — in this architecture, persistence and broadcast are effectively atomic, so `deliveredAt ≈ createdAt`. A queue-based fanout system would move this to the socket layer post-broadcast.
- **`toJSON` transforms `_id → id` and drops `__v`** — the REST response is clean and Mongoose-implementation-agnostic.
- **Index on `{ createdAt: -1 }`** — required for the cursor pagination query to be efficient.

---

## 7. Socket.io Architecture *(Feature 4)*

### Connection lifecycle

```
Client connects (HTTP upgrade → WebSocket)
   ↓
Socket.io CORS check (env.CORS_ORIGIN)
   ↓
Server logs 'socket connected' with socket.id
   ↓
Register per-domain handlers on this socket:
   • registerChatHandlers(io, socket)     → F4
   • registerPresenceHandlers(io, socket) → F9
   ↓
Handlers process events until:
   ↓
Client disconnects (transport close or explicit disconnect)
   ↓
Server logs 'socket disconnected' with reason
```

Disconnect mid-event is safe — Socket.io propagates the disconnect through the same emitter chain, and Node's event model tolerates handlers on a closed socket.

### Event catalog (Feature 4 scope)

| Direction | Event | Payload | Purpose |
|---|---|---|---|
| client → server | `message:send` | `{ username, content }` (+ optional ack callback) | Send a new message |
| server → all | `message:new` | Full message object (same shape as REST response) | Broadcast newly persisted message |
| server → sender | `message:error` | `{ code, message, details? }` | Validation or persistence failure |
| server → sender (ack) | *(no event name — via callback)* | `{ success: true, data }` or `{ success: false, error }` | Direct response to the sender's specific emit |

Feature 8 will add `typing:*`, Feature 9 adds `presence:*`, Feature 10 adds `message:ack`, `message:read`, `message:read-update`.

### Handler pipeline

The chat handler mirrors the REST pipeline — validate → service → respond:

```
message:send  →  validate(MESSAGE_BODY_SCHEMA, payload)
                       ↓  (valid)
                 messageService.createMessage(sanitized)
                       ↓
                 io.emit('message:new', message)         (broadcast to all)
                 ack({ success: true, data: message })   (respond to sender)

                       ↓  (invalid or persist failure)
                 socket.emit('message:error', payload)
                 ack({ success: false, error: payload })
```

Response envelope is identical to REST — `{ success, data | error }` — so a single client-side helper parses either channel.

### Broadcast strategy — `io.emit` vs rooms

Currently `io.emit(...)` sends to every connected socket. Simplest model for a single global lobby.

Path to multi-room support (documented but not built):
1. Clients emit `room:join { roomId }` on entry
2. Server does `socket.join(roomId)`
3. Replace `io.emit(NEW, msg)` with `io.to(roomId).emit(NEW, msg)`

Handler shape stays identical — only the emit target changes.

### Validation reuse across transports

The pure `validate(schema, data)` function in `middleware/validate.js` is called from:
- `validateBody(schema)` — Express middleware wrapper for REST routes
- `chatHandler.registerChatHandlers` — directly in the socket handler

Both consume `MESSAGE_BODY_SCHEMA` from `models/Message.js`, so the two transports cannot drift on what a valid message body looks like. This was the small refactor bundled into F4.2 — one schema, one validator, two transports.

### Ack callback pattern

Socket.io supports "acknowledgements" — the client passes a callback as the last argument to `emit`, and the server invokes it. Semantically equivalent to a request/response, but stays on the same socket connection with no extra round-trip.

We fire **both** the ack AND the `message:error` event on failure:
- Some clients wait for the ack (per-request response pattern)
- Some clients listen for a global `message:error` handler (broadcast-style)
- Firing both means either pattern works

### Graceful shutdown ordering

`server.js` shuts down in this order on SIGINT/SIGTERM:
1. `io.close()` — refuse new upgrades, close existing sockets
2. `httpServer.close()` — finish any in-flight REST requests
3. `disconnectDB()` — Mongo connection down
4. `process.exit(0)`

A 10-second `setTimeout(...).unref()` force-exits if any step hangs. The `.unref()` prevents the timer from keeping the event loop alive on a normal (fast) shutdown.

### Trade-offs and future improvements

| Now (F4) | Future |
|---|---|
| `io.emit` — everyone gets everything | Room-scoped `io.to(roomId).emit` for multi-room chat |
| Username sent in every payload | Auth handshake sets `socket.data.username`; handlers validate sender identity |
| No message deduplication on client tempIds | F10 introduces `tempId` + `message:ack` correlation |
| Single-process socket layer | `@socket.io/redis-adapter` for horizontally-scaled backends |
| No rate limiting on socket events | `socket.use((packet, next) => …)` middleware with per-user token bucket |

---

## 8. State Management Strategy *(Feature 5)*

### Overall approach

React Context + custom hooks. No Redux, no Zustand, no Jotai. The app's state graph is small (auth in F5, chat in F7, presence in F9, typing in F8) and every piece is naturally scoped to one Provider. A state library here would be net-negative — more surface area, more boilerplate, less obvious flow.

**Convention applied to every context in this app:**
- One Context per domain (`AuthContext`, `ChatContext`, `PresenceContext`)
- Provider owns the state and every side effect
- A companion custom hook (`useAuth`, `useChat`, `usePresence`) is the **only** way consumers touch the context — it wraps `useContext` and throws if the provider is missing

### AuthContext — the anchor

Shape: `{ user, login, logout, isAuthenticated }`. Placed at the root (`main.jsx`) so any component in the tree can call `useAuth()`.

**Persistence via `localStorage`.** Username survives refresh without any auth handshake. Read once at mount via `useState(readStoredUser)` initialiser — synchronous, no flash of unauthed content. All storage access wrapped in `try/catch` so Safari private mode / corporate policy failures degrade gracefully to in-memory-only.

**Namespaced key `chatapp:user`.** Prevents collision with any other app on the same origin.

**Client-side validation mirrors backend rules** (trim, non-empty, ≤50 chars). Defense in depth — the server still validates every socket/REST payload authoritatively.

### Optimisation pattern — memoise the context value

Every provider in this app follows the same shape:

```jsx
const login = useCallback(...);
const logout = useCallback(...);

const value = useMemo(
  () => ({ user, login, logout, isAuthenticated: user !== null }),
  [user, login, logout],
);

return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
```

Without `useMemo`, `value` is a fresh object every render, and every consumer re-renders whether or not the underlying data changed. This is the most common Context perf trap; the pattern is applied consistently everywhere we ship a provider.

### Custom hooks as the public API

Consumers **never** import `AuthContext` directly — they import `useAuth`. Three benefits:

- **Fail-loud on missing provider.** `useAuth` throws with a clear message if called outside `<AuthProvider>`. Silent `undefined` errors deep in a subtree are prevented at the source.
- **Refactor freedom.** If we ever swap Context for a store, only the hook body changes. Consumers stay identical.
- **Discoverable.** `useAuth` in a component immediately signals "this component depends on auth state" — grep-friendly and reviewer-friendly.

### Pattern reuse across later features

The same shape lands three more times:

| Feature | Context | Hook | State it exposes |
|---|---|---|---|
| F7 | `ChatContext` | `useChat` | `messages`, `sendMessage`, `hasMore`, `loadOlder`, connection status |
| F8 | *(local to input)* | `useTyping` | Debounced typing signal — no provider needed |
| F9 | `PresenceContext` | `usePresence` | `onlineUsers` roster |

Each provider uses the same `useCallback` + `useMemo` discipline. Each hook uses the same throw-if-missing-provider pattern.

### Alternatives rejected

| Alternative | Why not |
|---|---|
| **Redux Toolkit** | Excellent library, wrong scale. Our state is 3 slices, no complex derived selectors, no time-travel-debugging need, no cross-cutting middleware. Setup cost is real; benefits don't materialise. |
| **Zustand** | Great when Context perf becomes an issue at large scale — not here. Also skipped for consistency ("one state approach, applied everywhere"). |
| **A single "AppContext"** | Would couple auth, chat, and presence changes into one re-render blast radius. Small contexts keep updates localised. |
| **Prop drilling** | Would work today (small tree) but breaks the moment we need `useAuth` inside a nested `MessageInput`. Setting up the Context pattern early avoids the migration. |

### Auth gate placement

The auth check lives in `App.jsx`, not in individual screens:

```jsx
if (!isAuthenticated) return <LoginScreen />;
return <AuthenticatedShell />;
```

Single decision point. Adding a new authenticated screen means composing it inside the shell, not remembering to sprinkle auth guards. Per-component `useAuth` guards are a maintenance trap; centralising the gate keeps the responsibility in one obvious place.

---

## 9. Frontend Chat UI *(Feature 6)*

### Component tree

```
App                                (container — owns auth + mock state)
├── LoginScreen                    (unauthed branch)
└── AuthenticatedShell
    ├── shell-header               (brand + user badge + logout)
    └── ChatWindow                 (presentational)
        ├── MessageList
        │   └── MessageBubble (×N)
        └── MessageInput
```

**Design principle: containers own state, presentational components take props.** `App` decides what messages exist and what happens on send. `ChatWindow`, `MessageList`, `MessageBubble`, `MessageInput` do not call `useAuth` and do not fetch — they render what they're given.

Payoffs:
- Testing is trivial (pass props, assert output)
- Reuse is cheap (multi-room future — each room mounts its own `ChatWindow` with different props)
- Data flow is one-directional and obvious

Feature 7 will introduce `ChatContext` (REST + Socket). `App` will then read from `useChat()` instead of holding `useState` directly, but ChatWindow's prop contract stays identical.

### Timestamp formatting

`utils/formatTime.js` uses `Intl.DateTimeFormat` — native, zero deps, locale-aware.

Two branches:
- **Today:** just the time — `10:23 AM`
- **Older:** date + time — `Jul 12, 10:23 AM`

Showing `2026-07-12 10:23 AM` for a message that arrived five minutes ago is noise. Every polished chat app (Slack, WhatsApp, iMessage) follows this pattern.

*Alternative rejected:* `date-fns` (~100 KB) or `moment` (~250 KB). Intl covers the two format strings we actually need at zero cost.

### Auto-scroll to newest

Sentinel + `scrollIntoView` pattern:

```jsx
const bottomRef = useRef(null);
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
}, [messages.length]);
// ...
<div ref={bottomRef} />
```

Two deliberate choices:

- **Dependency is `messages.length`, not `messages`.** Prevents re-scroll when only receipt state (`readBy`) changes on existing messages. Critical for F10 when `message:read-update` events start firing frequently — otherwise the viewport would yank on every read event.
- **Sentinel div at the tail** is more robust than `containerRef.current.scrollTop = scrollHeight` — handles nested scroll containers, smooth animation, and edge cases.

**Known limitation (documented as future improvement):** auto-scrolls unconditionally. If the user has scrolled up to read history, an incoming message yanks them back. Production fix would gate on "user is near the bottom" (checking `scrollHeight - scrollTop ≈ clientHeight`).

### Own vs others styling

Two visual signals, not one:

| | Own | Other |
|---|---|---|
| Alignment | Right | Left |
| Bubble color | Blue (`#4a52d1`) | Grey (`#2f2f2f`) |
| Sender name | Hidden | Shown |

Two signals so users who don't perceive colors reliably still get instant identity feedback (accessibility). Sender-name-hidden-on-own is the Slack pattern — you know your own messages are yours.

### Message input UX

- `<textarea rows={1}>` (not `<input type="text">`) so multi-line paste is preserved
- **Enter to send, Shift+Enter for a newline** — the universal chat keybind
- Send button disabled when trimmed content is empty — no accidental empty submits
- Client `maxLength={1000}` matches backend `MESSAGE_BODY_SCHEMA.content` — browser physically caps typing
- Input clears on send — standard UX
- `disabled` prop on the whole input row — used by F7 when the socket disconnects
- `resize: none` removes the browser's manual resize handle (looks unpolished in chat UIs)
- `min-height` + `max-height` in CSS gives a compact starting height that grows a bit before scrolling internally — cheap "grows-as-you-type" feel without JS

### CSS approach

Vanilla CSS, one file per feature area (`auth.css`, `shell.css`, `chat.css`). No CSS-in-JS, no Tailwind, no PostCSS pipeline beyond what Vite ships.

Rationale:
- Zero setup, zero extra tooling — Vite handles it natively
- Prefixed class namespaces (`chat-`, `msg-`, `shell-`, `auth-`) are grep-friendly
- The UI surface is small enough that a design system would be overkill

**Swap candidate if the surface grows:** CSS Modules (Vite has built-in support via `.module.css`). Migration is per-file — components change `className="chat-window"` to `className={styles.chatWindow}`. Contained blast radius.

### Empty state

Rendered by `MessageList` when `messages.length === 0`:
> No messages yet.
> Say hi to break the ice.

Small product touch — signals "the app is working, just quiet" instead of leaving the user wondering "is it loading?"

### Trade-offs and future improvements

| Now (F6) | Future |
|---|---|
| Local mock state in `App.jsx` | Replaced by `ChatContext` (REST + Socket) in F7 |
| Auto-scroll on every new message | Sticky-bottom detection — only scroll if user is already near the bottom |
| Vanilla CSS with prefixed classes | CSS Modules for hard scope isolation if the UI surface grows |
| Textarea with static min/max height | JS auto-grow (`scrollHeight`-driven) for a smoother feel |
| No message editing / deletion | `PATCH` / `DELETE /api/messages/:id` with confirm modal + soft-delete |
| No attachments | Multipart upload + object storage; extend Message with `attachments[]` |

---

## 10. REST + Socket Client Integration *(Feature 7)*

### Overall architecture

Two transports fused behind one Context:

```
                    ┌──────────────────────┐
                    │     <App />          │
                    │  useAuth().user      │
                    └──────────┬───────────┘
                               │ if authenticated
                    ┌──────────▼───────────┐
                    │  <ChatProvider>      │
                    │  username={user}     │
                    └──────────┬───────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
   REST (axios)          Socket (singleton)     React state
   • fetchMessages()     • connect/disconnect   • messages[]
     on mount            • message:new          • isConnected
     → history[]         • message:send         • isLoadingHistory
                                                • historyError
                               │
                    ┌──────────▼───────────┐
                    │  useChat() consumer  │
                    │  <ChatWindow />      │
                    │  <ConnectionBanner/> │
                    └──────────────────────┘
```

REST provides the **initial state**; the socket provides the **stream of updates**. Both write into the same `messages` array — deduped by `id` so the join is lossless.

### REST client — `api/client.js`

Axios instance configured with:
- `baseURL` from `VITE_API_URL`
- `timeout: 10s` — hung requests fail fast instead of leaving the UI spinning
- Response interceptor that:
  - **Unwraps** `{ success: true, data }` → returns just `data` so consumers write `const history = await fetchMessages()`, not `.data.data`
  - **Normalises** `{ success: false, error: { code, message, details } }` into a real `Error` with those fields attached

The whole rest of the app catches `try { ... } catch (err) { err.code, err.message, err.details }` without ever unpacking Axios internals.

*Alternative rejected:* `fetch`. Would require re-implementing timeout, interceptors, and JSON handling. Axios earns its 30 KB.

### Socket singleton — `socket/index.js`

One `socket.io-client` instance for the whole app, created lazily on the first `getSocket()`. Config:
- `transports: ['websocket']` — skip long-polling
- `autoConnect: true` — connect on creation
- Reconnection: `Infinity` attempts, 1 s initial delay, up to 5 s with backoff

Rationale: multiple sockets per tab would waste connections and confuse server-side presence tracking (F9). A module-level singleton in ES modules is naturally shared — no Context needed for this concern.

### `ChatContext` — the state layer

Provider maintains `{ messages, sendMessage, isConnected, isLoadingHistory, historyError }`.

**Two independent effects, one per concern:**

```
useEffect (once)
  ↓
fetchMessages()          ──→ setMessages (merged with any live already received)
                             setIsLoadingHistory(false)

useEffect (once)
  ↓
socket.on('connect')     ──→ setIsConnected(true)
socket.on('disconnect')  ──→ setIsConnected(false)
socket.on('message:new') ──→ setMessages (dedupe by id, append)
```

Split effects keep each side effect small and independently reasoned about — a REST failure doesn't affect socket lifecycle handling.

### Race handling — history vs live merge

The single non-obvious correctness detail. If a `message:new` arrives BEFORE the REST history fetch resolves, we don't want to overwrite the live message when history lands. The merge:

```js
setMessages((prev) => {
  const historyIds = new Set(history.map((m) => m.id));
  const liveOnly = prev.filter((m) => !historyIds.has(m.id));
  return [...history, ...liveOnly];
});
```

Preserves both. Dedupes by `id`. Chronological order maintained (history is oldest→newest per API contract; live messages naturally appended in arrival order).

Fetch cancellation via a `cancelled` flag in the effect cleanup prevents `setState` on an unmounted provider (e.g. logout mid-load).

### Send path — socket, not REST

The frontend sends over the socket, not `POST /api/messages`. Reasons:

- **Lower latency.** Socket message stays on the open TCP connection — no HTTP handshake, no auth negotiation.
- **Consistent event model.** Sender receives its own message via the same `message:new` broadcast every other client gets. Single code path renders it.
- **Broadcast atomicity.** Server persists + broadcasts in one handler; REST would require the controller to also `io.emit`, dragging the `io` dependency into the HTTP layer.

The REST `POST /api/messages` endpoint still exists on the backend — the assessment requires it, and it serves as a fallback (e.g. a future "resend failed message" flow when the socket is down). It just isn't the primary path from this UI.

### Reconnection UX

`ConnectionBanner` renders a subtle red pulse-dot bar when `!isConnected`. Auto-hides on reconnect.

Simultaneously, `MessageInput` receives `disabled={!isConnected}` and greys itself out — the user physically cannot send while offline.

The socket handles reconnection itself (Socket.io's `reconnection` config); we surface its state, we don't drive it. The moment Socket.io re-emits `'connect'`, the banner vanishes and input re-enables — no user action required.

*Alternatives rejected:* modal on disconnect (too aggressive for a transient blip); toast that disappears (leaves the user unaware if the disconnect persists).

### Socket persistence across logout

The socket singleton persists across `AuthContext` state changes. On logout, `ChatProvider` unmounts and removes its listeners; the socket stays open. On re-login (with any username), a fresh `ChatProvider` mounts and re-subscribes. History is refetched on each mount.

Feature 9 will introduce explicit `disconnectSocket()` on logout so the server sees a proper "user left" presence event. Not needed for F7 since presence isn't in scope yet.

### Trade-offs and future improvements

| Now (F7) | Future |
|---|---|
| Load newest 50; no pagination UI | Infinite-scroll upward via `?before=<cursor>`; both the service and the Context already support it |
| No optimistic send | Feature 10 introduces optimistic push + tempId + `message:ack` reconciliation for the delivered-tick UX |
| Retry-via-refresh on history load failure | Explicit "Retry" button that calls a `retryHistory()` action exposed from ChatContext |
| Socket stays connected on logout | Feature 9 disconnects the socket on logout so the server's presence roster stays accurate |
| No offline queue | Buffer messages while `!isConnected` and flush on reconnect (with tempId ids) |
| No client-side message deduplication on tempIds | Feature 10's tempId + ack correlation handles this natively |

---

## 11. Typing Indicator *(Feature 8)*

### Event model

Two new socket events, both **relayed** (not aggregated) by the server:

| Direction | Event | Payload |
|---|---|---|
| client → server | `typing:start` | `{ username }` |
| server → all *except sender* | `typing:start` | `{ username }` |
| client → server | `typing:stop` | `{ username }` |
| server → all *except sender* | `typing:stop` | `{ username }` |

Server maintains **no aggregated typing state**. Each client keeps its own "who's typing" set based on the stream of events it receives.

### Server-side design

Three additions to `chatHandler.registerChatHandlers`:

- `typing:start` handler: stores `socket.data.typingAs = username`, then `socket.broadcast.emit('typing:start', { username })`
- `typing:stop` handler: clears `socket.data.typingAs`, then `socket.broadcast.emit('typing:stop', { username })`
- Extra `disconnect` listener: if `socket.data.typingAs` is set, broadcast `typing:stop` on the user's behalf — ensures other clients don't show "X is typing" forever if that user's browser crashed

`socket.broadcast.emit` (not `io.emit`) sends to everyone **except** the sender — users don't see themselves listed as typing.

`socket.data` is Socket.io's per-socket state bag, perfect for stashing a small transient value like the current typing username.

Multiple `'disconnect'` listeners coexist without conflict (Node's EventEmitter pattern) — this handler runs alongside the logging listener in `sockets/index.js`.

### Client-side design — `useTyping` hook

Two responsibilities:

1. **Emit** on the current user's keyboard activity
2. **Listen** for others' events and expose a `typers` array

**Emit rhythm:**
- **`typing:start` throttled to every 2 s** while actively typing (via a `lastStartEmitRef` timestamp). Keeps receivers' staleness timers refreshed without spamming — a fast typist still emits at most once per 2 s.
- **`typing:stop` fires after 2 s idle** (debounced `setTimeout` reset on every keystroke) OR immediately on blur / after send via `handleStopTyping()`.

**Listener state:**
- `typers: string[]` — usernames currently typing (never includes self)
- Filters `typer === currentUsername` (belt-and-suspenders; server already excludes sender)
- Dedupes on add

### Three-layer resilience for stale typers

If a user's client crashes mid-typing, others could see "X is typing…" forever without careful handling. Three cascading layers ensure it clears:

1. **Explicit `typing:stop`** — normal path when the user stops or sends
2. **Server disconnect cleanup** — server broadcasts `typing:stop` when the socket closes (from `socket.data.typingAs`)
3. **Client staleness timer** — receiver-side, remove any typer we haven't heard `typing:start` from within 5 s (safety net for the rare case both above fail)

Layer 3 is why the sender's `typing:start` is a **throttled keep-alive** (every 2 s) rather than a one-shot event. Receivers' staleness timers reset with each incoming `typing:start`, so continuously typing users stay in the set.

### Own-state reset on socket disconnect

When the client's socket disconnects, `useTyping` resets `isTypingRef`, clears the debounce timer, and empties the `typers` array. On reconnect:
- Next keystroke starts a fresh typing session (emits `typing:start` immediately)
- Other users' typing state re-populates as they emit their next `typing:start`

Prevents the "I'm reconnected but the server still thinks I'm typing" desync.

### Multi-typer formatting

| Typers | Rendered text |
|---|---|
| 1 | `alice is typing…` |
| 2 | `alice and bob are typing…` |
| 3 | `alice, bob, and carol are typing…` |
| 4+ | `alice, bob, and 2 more are typing…` |

The four-plus corner case is the one amateur implementations get wrong (endless comma-separated list). WhatsApp, Discord, and Slack all fold long lists — we do too.

### Layout jitter prevention

The `TypingIndicator` container **always renders**, even when `typers.length === 0`. Its `min-height: 1.5rem` reserves the space; content only appears when someone is actually typing. Without this, the layout would jitter (list area growing by ~24 px when the indicator disappears, then shrinking again when it reappears).

Trade-off: a ~24 px sliver of always-reserved space. Barely noticeable when empty, buttery-smooth when it flips.

### Container / presentational split (again)

`useTyping` is called in `AuthenticatedApp` (container), not inside `MessageInput` or `ChatWindow`. The typing outputs (`typers`, `handleTyping`, `handleStopTyping`) are passed down as props. Same discipline as `useChat` in F7 — presentational components stay dumb.

`MessageInput` calls `onType()` on every `onChange` and `onStopTyping()` on `onBlur` + immediately after send. It doesn't know or care what those functions do.

### Trade-offs and future improvements

| Now (F8) | Future |
|---|---|
| Server relays events; no server-side aggregation | Server-side typing map with authoritative typers list (needed if clients can't be trusted) |
| No rate limiting on typing events | `socket.use(...)` middleware with a per-user token bucket — prevents malicious flood |
| Username sent in every payload | Auth handshake sets `socket.data.username` at connect; typing events omit it |
| Staleness timeout is fixed 5 s | Configurable per deployment; shorter on high-latency networks would feel snappier |
| Text-only rendering for 4+ typers | Avatar chips for visual density (Slack pattern) |

---

## 12. Online Presence *(Feature 9)*

### Event model

Three socket events power the roster:

| Direction | Event | Payload | Semantics |
|---|---|---|---|
| client → server | `presence:join` | `{ username }` | "I'm here" — announce yourself |
| server → joiner | `presence:list` | `{ users }` | Full current roster (unicast response to the announcer) |
| server → all *except sender* | `presence:join` | `{ username }` | Broadcast: someone new came online |
| server → all *except sender* | `presence:leave` | `{ username }` | Broadcast: someone went offline (last tab closed) |

Unlike typing (§11), presence needs **server-side state** — a fresh joiner has to see who is ALREADY online, not just future join/leave events. Server holds the authoritative roster.

### Server design — `presenceHandler.js`

Module-level `Map<socketId, username>` — one entry per active socket. Multi-tab handling falls out of this naturally:

- **Join broadcast** fires only when `countSocketsFor(username) === 0` before the insert (i.e., the user's FIRST socket connects). Opening a second tab doesn't spam other clients with a duplicate join.
- **Leave broadcast** fires only when `countSocketsFor(username) === 0` after the delete (i.e., the user's LAST socket closes). Closing one tab of two doesn't broadcast a leave.
- **`presence:list` unicast** goes to the joiner only via `socket.emit`. Other clients already have accurate rosters from historical join events.

`socket.data.presenceUsername` stashes the username per socket so the disconnect handler knows who to `leave` on behalf of — same pattern as `socket.data.typingAs` from F8.

**Single-process only.** The Map is module state, not distributed. Multi-instance backends would need `@socket.io/redis-adapter` to sync rosters across processes. Documented as future improvement.

### Client design — `usePresence` hook

Announces on `'connect'`, listens for the three server events, exposes `onlineUsers: string[]`.

**Announce timing:**
- If socket is already connected when the hook mounts, emit `presence:join` immediately
- Otherwise, wait for the `'connect'` event to fire
- The same handler fires again on Socket.io's automatic reconnect — a network blip re-announces us to the server

**State updates:**
- `presence:list` **replaces** the local list (server is source of truth)
- `presence:join` **adds** the joiner (dedupe on insert)
- `presence:leave` **removes** the leaver
- `disconnect` **clears** the list (fresh state on reconnect via new `presence:list`)

Same shape as `useTyping` — consumers pattern-match.

### Disconnect-on-logout — the full flow

Presence would be badly stale if a logged-out user stayed on the login screen (browser tab still open, socket still connected → server still shows them online). We close the socket on logout so the server sees a clean departure.

Chain of events on Logout click:

```
AuthContext.logout()
   ↓
isAuthenticated flips false
   ↓
App re-renders → returns <LoginScreen /> instead of <AuthenticatedApp />
   ↓
AuthenticatedApp + ChatProvider + hooks unmount
   → useEffect cleanups remove socket listeners
   ↓
App's useEffect keyed on isAuthenticated fires with false
   → calls disconnectSocket()
   ↓
socket.disconnect() → server sees 'disconnect'
   ↓
Server-side chatHandler.disconnect: broadcasts typing:stop if socket was typing
Server-side presenceHandler.disconnect: broadcasts presence:leave (last socket)
   ↓
Other clients: remove user from their rosters, remove from typers set
```

On re-login (same or different username):
- `AuthenticatedApp` mounts again → hooks re-attach listeners
- `getSocket()` returns the disconnected singleton but detects `!socket.connected` and calls `.connect()` — reuses the same instance, no leak
- `usePresence` waits for `'connect'` then emits `presence:join` with the new username
- Server registers, broadcasts join, replies with the fresh `presence:list`

### Socket singleton — auto-reconnect refinement

`getSocket()` gained a small guard:

```js
if (socket) {
  if (!socket.connected) socket.connect();
  return socket;
}
```

Rationale: after explicit `.disconnect()`, Socket.io keeps the instance alive but does NOT auto-reconnect (auto-reconnect only handles UNEXPECTED disconnects). Without this guard, `getSocket()` after logout+login would hand back a dead socket. The two-line check makes the singleton lifecycle robust across login/logout cycles.

*Alternative rejected:* resetting the singleton to `null` on disconnect and creating a fresh instance next time. Would leak the previous instance's listener registrations if anything held a reference; the connect-if-disconnected path preserves identity and is simpler.

### `OnlineUsers` sidebar — UI design

- **Semantic `<aside>` with `aria-label="Online users"`.** Screen readers announce it as a landmark region.
- **Sort:** current user first, then alphabetical. You always know where you are.
- **Two identity signals for self** — highlighted background AND a `you` tag. Same accessibility discipline as own-vs-others message bubbles (F6) — don't rely on color alone.
- **Green online-dot per user** with a subtle glow — a scannable visual affordance beyond the text.
- **Fixed sidebar width 240 px**, `flex-shrink: 0`. Wide enough for realistic usernames; not so wide it dominates the chat.
- **Media query hides the sidebar under 700 px viewport width** — narrow screens give the whole width to the chat. Not a full mobile experience, but doesn't break there.

### Layout — `.chat-layout` flex row

New wrapper inside `shell-body` composes ChatWindow (left, flex-grow) + OnlineUsers (right, fixed width) as a horizontal pair, capped at `max-width: 1200 px` and centered. Only the "loaded" branch of the ternary uses this container — loading and error states remain centered as before.

`ChatWindow` released its own `max-width: 900 px` and gained `flex: 1; min-width: 0` so it flexes inside the layout. `min-width: 0` is the flex-shrink trick that lets the message list actually clip content instead of pushing the sidebar off-screen.

### Trade-offs and future improvements

| Now (F9) | Future |
|---|---|
| In-memory `Map<socketId, username>` (single-process) | `@socket.io/redis-adapter` to sync rosters across horizontally-scaled backends |
| Username in every `presence:join` payload | Auth handshake sets `socket.data.username` at connect; presence infers it |
| No "last seen" for offline users | Persist last-seen timestamps to Mongo; show "offline for 5m" |
| No idle detection | Detect no-input-for-N-minutes and broadcast a `presence:idle` state |
| Sidebar hidden under 700 px | Full mobile experience with sidebar-as-drawer |
| No sorting beyond self-first / alphabetical | Group by "typing", "active", "idle"; or by recently-active |

---

## 13. Sections Reserved for Later Features

- **Read receipt update patterns** *(Feature 10)* — the Message schema and pagination live in §6; only the receipt-write flow remains
- **Deployment topology — Render + Vercel + Atlas** *(Feature 11)*
- **Trade-offs table (final summary)** *(Feature 11)*
- **Future improvements** *(Feature 11)*

Each of these becomes a first-class section as its feature lands.
