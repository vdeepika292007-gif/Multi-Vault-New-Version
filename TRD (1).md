# Multi Vault — Technical Requirements Document (TRD)

**Version:** 1.0 | **Project:** New application from scratch

## Architecture
- Frontend alternatives: React, Angular, and Vue.js as separate applications.
- Backend: Node.js + Express.js REST API returning JSON.
- Database: MongoDB accessed only by the backend, using Mongoose or another justified MongoDB library.
- The browser must never connect directly to MongoDB.

## New folder
Create `Multi Vault New Version` from Windows Terminal and verify the working directory. Do not inspect, copy, modify, or depend on any older project.

Suggested structure:
```text
Multi Vault New Version/
├── backend/
├── frontend-react/
├── frontend-angular/
├── frontend-vue/
├── docs/
│   ├── PRD.md
│   ├── TRD.md
│   ├── DESIGN_SPEC.md
│   ├── IMPLEMENTATION_PROMPT.md
│   └── learning-log.md
├── .gitignore
└── README.md
```
Keep `.env` and secrets out of Git. Add `.env.example` with placeholder names only.

## Suggested stack
Node.js LTS, Express.js, MongoDB local or Atlas, Mongoose, React with Vite, Angular CLI, Vue with Vite, shared CSS tokens, and suitable tests. Check installed versions and explain prerequisites before installing software.

## Backend responsibilities
Validate requests; authenticate/authorize users; enforce ownership; read/write MongoDB; return consistent JSON; handle errors safely; expose `GET /api/health`; use suitable security middleware and request limits; configure CORS narrowly. Use environment variables such as `PORT`, `MONGODB_URI`, auth/session secrets, and allowed origins. Never put secrets in frontend code or Git.

## Initial data models
- **User:** `name`, normalized unique `email`, `passwordHash`, timestamps.
- **Note:** `userId`, `title`, `content`, `tags`, optional `linkedNoteIds`, timestamps.
- **JournalEntry:** `userId`, `entryDate`, `content`, timestamps; unique compound index `{ userId, entryDate }`.
- **Settings (optional):** supported preferences only.

Never trust browser-supplied `userId`; derive the user identity from authenticated server context.

## API outline
Prefix with `/api`:
- `GET /api/health`
- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- `GET /api/auth/me`
- `GET/POST /api/notes`
- `GET/PATCH/DELETE /api/notes/:id`
- `GET /api/tags`
- `GET /api/journal?date=YYYY-MM-DD`, `GET /api/journal`, `PUT /api/journal/:date`
- `GET /api/dashboard`, `GET /api/graph`
- `GET /api/settings`, `PATCH /api/settings` only if implemented

Document request/response shapes, status codes, validation failures, and auth errors.

## Security and testing
Hash passwords, validate server inputs, use appropriate secure session/cookie settings, narrow CORS, avoid unsafe raw query construction, rate-limit authentication, protect secrets, and enforce ownership on private routes. Use HTTPS in deployment.

Test server health, database connection, authentication, unauthenticated rejection, user-to-user data isolation, note CRUD/search/tags, journal uniqueness, dashboard/graph, API error states, responsive UI, and independent startup of each frontend. Never claim a test passed unless run.

## Phases
1. Verify terminal, folder path, Node.js/npm, and database choice.
2. Create folder and documentation.
3. Build Express health endpoint.
4. Connect MongoDB.
5. Implement models, auth, and API.
6. Test backend.
7. Build/test React.
8. Build/test Angular.
9. Build/test Vue.
10. Finish README, learning log, and regression tests.

Do not build all frontends at once.
