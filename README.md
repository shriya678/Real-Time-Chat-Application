# Real-Time Chat Application

A real-time group chat lobby with dummy username auth, typing indicators, online presence, and WhatsApp-style delivered / read receipts. Built as a 24-hour take-home assessment.

> **Live frontend:** [https://real-time-chat-application-wheat-one.vercel.app/](https://real-time-chat-application-wheat-one.vercel.app/)
> **Backend API:** [https://real-time-chat-application-ntu2.onrender.com/health](https://real-time-chat-application-ntu2.onrender.com/health)
> Render free-tier note: the first request after 15 min of inactivity takes 30–60 s to wake the server (cold start). Subsequent requests are instant.

---

## Features

**Mandatory (assessment spec):**
- Send messages via REST — `POST /api/messages`
- Fetch chat history via REST — `GET /api/messages` (cursor-paginated, chronological)
- Live message delivery via Socket.io — no polling
- Server broadcasts new messages to all connected clients
- Server-generated timestamps on every message
- History persists across refresh (MongoDB Atlas)
- Graceful connect / disconnect handling

**Bonus — all 5 delivered:**
- Username-based dummy login (localStorage-persisted)
- Typing indicator with multi-typer formatting (`X, Y, and N more are typing…`)
- Online / offline user sidebar with multi-tab dedup
- Message delivered + read receipts — `✓` sent, `✓✓` delivered, `✓✓ blue` read
- Deployed on Render (backend) and Vercel (frontend)

---

## Screenshots

<!-- TODO: capture screenshots after final deploy and drop them under docs/screenshots/ -->
_Add screenshots of: login screen, chat with mixed own/other messages showing receipts, online-users sidebar, typing indicator._

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + axios + socket.io-client |
| Backend | Node.js 20 + Express 4 + Socket.io + Mongoose |
| Database | MongoDB Atlas (M0 free tier) |
| Deploy | Render (backend) + Vercel (frontend) |
| Styling | Vanilla CSS, dark theme |

See [`docs/APPROACH.md`](docs/APPROACH.md) for the "why each choice" narrative and every feature's design rationale.

---

## Quick start — local development

Requires **Node.js 20 LTS** + a **MongoDB Atlas** connection string (free M0 tier works).

**1. Clone + install:**
```bash
git clone https://github.com/shriya678/Real-Time-Chat-Application.git
cd Real-Time-Chat-Application

# Backend deps
cd backend
npm install

# Frontend deps (in a second terminal)
cd ../frontend
npm install
```

**2. Env vars — copy the templates and fill in:**
```bash
# Backend
cp backend/.env.example backend/.env
# Then edit backend/.env — set MONGODB_URI to your Atlas connection string

# Frontend
cp frontend/.env.example frontend/.env
# Defaults already point at http://localhost:5000 — no edits needed for local dev
```

**3. Run both:**
```bash
# Terminal 1
cd backend
npm run dev
# → mongo connected
# → server listening on http://localhost:5000

# Terminal 2
cd frontend
npm run dev
# → VITE ready in ...
# → http://localhost:5173/
```

Open `http://localhost:5173` (Vite may fall back to 5174 if 5173 is busy — both are pre-allowed in the CORS default). Pick any username and start chatting.

---

## Environment variables

**Backend — `backend/.env`:**
| Var | Example | Required |
|---|---|---|
| `PORT` | `5000` | Yes (Render provides its own `PORT` automatically) |
| `NODE_ENV` | `development` / `production` | Yes |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/chatapp` | Yes |
| `CORS_ORIGIN` | `http://localhost:5173,https://myapp.vercel.app` | Yes (comma-separated for multiple origins) |
| `LOG_LEVEL` | `info` | No (defaults to `info`) |

**Frontend — `frontend/.env`:**
| Var | Example | Required |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000` (dev) / `https://<render-url>` (prod) | Yes |
| `VITE_SOCKET_URL` | Same as `VITE_API_URL` typically | Yes |

---

## Project structure

```
Real-Time-Chat-Application/
├── .github/
│   └── PULL_REQUEST_TEMPLATE.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── config/         # env, db — read once, exported frozen
│       ├── middleware/     # notFound, errorHandler, validate, asyncHandler
│       ├── models/         # Mongoose schemas (Message)
│       ├── controllers/    # HTTP handlers — thin, delegate to services
│       ├── services/       # business logic — no req/res, pure I/O
│       ├── routes/         # Express routers
│       ├── sockets/        # Socket.io handlers (chat, presence)
│       ├── utils/          # logger
│       ├── app.js          # Express instance factory (importable)
│       └── server.js       # HTTP lifecycle + graceful shutdown
├── frontend/
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── api/            # axios client + fetchMessages
│       ├── socket/         # socket.io-client singleton
│       ├── context/        # AuthContext, ChatContext
│       ├── hooks/          # useAuth, useChat, useTyping, usePresence, useReadReceipts
│       ├── components/     # LoginScreen, ChatWindow, MessageList, MessageBubble,
│       │                   # MessageInput, TypingIndicator, OnlineUsers, ConnectionBanner
│       ├── utils/          # formatTime, receiptIcons
│       ├── styles/         # auth.css, shell.css, chat.css
│       ├── App.jsx
│       └── main.jsx
├── docs/
│   ├── REQUIREMENTS.md     # Functional + non-functional requirements (locked)
│   ├── APPROACH.md         # Living design doc, per-feature rationale
│   └── TECHNICAL_DESIGN.md # Deep interview-prep doc
└── README.md
```

---

## Design decisions — quick summary

Full narrative and per-feature deep dives live in [`docs/APPROACH.md`](docs/APPROACH.md). Highlights:

- **Layered backend** (routes → controllers → services → models) — each layer has one reason to change
- **Cursor pagination** for chat history — stable during live writes, O(log N) at any depth
- **`app.js` split from `server.js`** — Express is importable in tests without opening a socket
- **Optimistic send + tempId reconciliation** via `message:send` echo — sender feels instant, race-safe
- **Server as pure relay for typing**, **server as roster-authoritative for presence** — different semantics need different designs
- **IntersectionObserver-triggered read receipts** with per-user `readBy` tracking; atomic `$push + $ne` dedup at the DB level
- **Context + custom hooks** as state model (no Redux) — right-sized for the state graph
- **Dark scrollbars via `color-scheme` + `::-webkit-scrollbar`** so the browser chrome matches the app theme

---

## Development approach

Built feature-by-feature with **one PR per feature — 10 PRs total** (F2 backend skeleton through F11 deploy + docs). Each PR carries a rich description: Summary, Problem/Context, Changes, Technical Approach, API/DB changes, Testing Done, Notes for Reviewer.

Browse [Pull Requests](https://github.com/shriya678/Real-Time-Chat-Application/pulls?q=is%3Apr) for the build story in order.

No automated test framework — deliberately deferred per the 24-hour budget. Every feature was smoke-tested end-to-end (multi-window / multi-user) before merge; the checklist for each is in the PR's "Testing Done" section.

---

## Known limitations / future improvements

- **Render free-tier cold start** — first request after 15 min idle takes 30–60 s.
- **Any-read = blue tick** (not WhatsApp's all-read). Trade-off documented in [`docs/APPROACH.md`](docs/APPROACH.md) §13.
- **Single-process socket server** — multi-instance backend would need `@socket.io/redis-adapter`.
- **In-memory presence roster** — resets on backend restart (Redis adapter would fix).
- **No client-side idle detection** — users stay "online" until they close the tab.
- **No offline message queue** — messages typed while disconnected aren't buffered.
- **No pagination UI** — service supports `?before=<cursor>` but the frontend loads only the newest 50.

See [`docs/APPROACH.md`](docs/APPROACH.md)'s per-feature "Trade-offs and future improvements" tables for the full catalogue with rationale.

---

## Author

Shriya Gupta · [guptashriya035@gmail.com](mailto:guptashriya035@gmail.com)
