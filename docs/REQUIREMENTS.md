# REQUIREMENTS

## Overview
A real-time chat application in which any user can join a single global room ("Lobby") with a chosen username, send and receive text messages instantly, and see previous conversation history after refresh. The app must demonstrate a Socket.io-driven live experience backed by a persistent store, with a clean layered architecture and production-grade error handling.

The submission is a 24-hour take-home technical assessment. It is graded on: correctness of the mandatory features, clarity of the architecture, quality of documentation, and the polish of any bonus features.

---

## Functional Requirements

### Mandatory
| ID | Requirement |
|---|---|
| F1 | REST endpoint to send a message (`POST /api/messages`) |
| F2 | REST endpoint to fetch chat history (`GET /api/messages`) |
| F3 | Live message receive over Socket.io — no polling |
| F4 | Server broadcasts new messages to all connected clients |
| F5 | Each message carries a server-generated timestamp |
| F6 | History persists across refresh (MongoDB Atlas) |
| F7 | Graceful connect / disconnect handling on the server |

### Bonus (in scope)
| ID | Requirement |
|---|---|
| B1 | Dummy username-based login (no real authentication) |
| B2 | Typing indicator ("X is typing…") |
| B3 | Online / offline user presence list |
| B4 | Backend deployed on Render; frontend deployed on Vercel |
| B5 | Message delivered + read receipts (WhatsApp-style ticks) |

---

## Non-Functional Requirements

- **Architecture:** Layered backend (`config → middleware → routes → controllers → services → models`); component + hook + context organisation on the frontend.
- **Error handling:** All REST endpoints return a consistent JSON error shape; Socket.io emits typed error events to the offending client; no crash on malformed input.
- **Configuration:** All environment-specific values in `.env`; no hardcoded URLs, credentials, or origins.
- **Style consistency:** Prettier enforced across both packages.
- **Documentation:** `README.md`, `docs/REQUIREMENTS.md`, `docs/APPROACH.md`, `docs/TECHNICAL_DESIGN.md`.
- **Version control:** Feature-branch workflow, Conventional Commits, one PR per feature using the shared PR template.
- **Runtime:** Node.js 20 LTS, modern browsers (Chromium, Firefox).

---

## Assumptions

- Single global chat room; no private rooms or DMs in this iteration.
- The username is a client-supplied string cached in `localStorage`. There is **no** password, JWT, or session.
- Messages are plain text, ≤1000 characters. No attachments, no formatting.
- MongoDB Atlas free tier is acceptable for persistence.
- Users installing the app locally will use Node 20 LTS.
- Reviewers will access a hosted demo (Render + Vercel) and a screen recording; they may also run the app locally.

---

## Scope

**In scope**
- Mandatory features F1–F7 in full.
- Bonus features B1–B5 in full.
- Deploy to public URLs.
- Full documentation set (REQUIREMENTS, APPROACH, TECHNICAL_DESIGN, README).
- Feature-branch workflow with PRs.

**Out of scope**
- Multiple or private rooms, direct messages, message editing / deletion.
- Real authentication (OAuth, JWT, password hashing).
- File uploads, emoji picker, message reactions.
- Push notifications, offline queue, mobile-native builds.
- Automated test suite beyond manual smoke tests.

---

## Data Model (summary)

**Message** (MongoDB `messages` collection)
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Mongo default |
| `username` | String | Sender's dummy username |
| `content` | String | Trimmed, 1–1000 chars |
| `deliveredAt` | Date | Set on successful broadcast |
| `readBy` | Array<{ username: String, readAt: Date }> | Populated as recipients mark read |
| `createdAt` | Date | Mongoose timestamp — the canonical "sent at" |
| `updatedAt` | Date | Mongoose timestamp |

Indexes: `{ createdAt: -1 }` for history pagination.

---

## API Summary

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness + DB status |
| `GET` | `/api/messages` | Paginated history (`?limit=`, `?before=` cursor) |
| `POST` | `/api/messages` | Persist a new message (alternative to socket path) |

Full request / response shapes are documented in [`docs/TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md).

---

## Socket Event Summary

| Direction | Event | Purpose |
|---|---|---|
| client → server | `message:send` | Send a new message |
| server → all | `message:new` | Broadcast newly persisted message |
| server → sender | `message:ack` | Confirm delivery + return canonical id |
| client → server | `message:read` | Mark a message as read by this user |
| server → all | `message:read-update` | Broadcast updated `readBy` |
| client → server | `typing:start` / `typing:stop` | Typing indicator |
| server → all | `typing:update` | Aggregated typing state |
| server → all | `presence:join` / `presence:leave` | Roster changes |
| server → all | `presence:list` | Full roster on connect |
| server → sender | `message:error` | Validation / persistence failure |

---

## Success Criteria

The assessment is considered successfully delivered when:

1. All F1–F7 acceptance criteria pass on the deployed URL.
2. All B1–B5 bonus features are visibly working end-to-end.
3. `README.md` lets a stranger run the app locally in under five minutes.
4. `APPROACH.md` explains every architectural decision with alternatives considered.
5. `TECHNICAL_DESIGN.md` covers architecture, flows, data model, APIs, socket events, and scalability at interview depth.
6. The GitHub repository contains a clean feature-branch history with descriptive commits and PRs.

---

*Locked at Feature 2. Any change to this document after this point must include a rationale in the PR that changes it.*
