# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Android APK automated build platform with Git repository management, build automation, and log viewing.

**Stack**: Vue 3 + TypeScript (frontend), Node.js + Express + Prisma (backend)

## Development Commands

### Backend (backend/)
```bash
npm install              # Install dependencies
npm run db:push          # Initialize/sync database schema
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Build for production
npm run db:studio        # Open Prisma Studio (database GUI)
```

### Frontend (frontend/)
```bash
npm install              # Install dependencies
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Build for production
npm run test             # Run tests once
npm run test:watch       # Run tests in watch mode
```

## Architecture

### Backend Structure
```
backend/src/
├── routes/          # API endpoints (auth, projects, builds, settings)
├── services/        # Business logic (build execution engine)
├── middleware/      # Auth middleware (JWT verification)
├── utils/           # Utilities (git, transform)
├── config.ts        # System configuration (workspace paths)
├── db.ts            # Prisma client instance
└── index.ts         # Express app entry point
```

**Key patterns:**
- All API responses use snake_case (frontend) via `toSnakeCase()` transform
- Authentication via JWT stored in localStorage, auto-attached by axios interceptor
- Build execution runs asynchronously via `startBuild()` service
- Git operations use shell commands (security note: needs input sanitization)

### Frontend Structure
```
frontend/src/
├── views/           # Page components (Login, Projects, ProjectDetail, etc.)
├── components/      # Reusable components (StatCard, EmptyState)
├── api/             # API client (axios with interceptors)
├── stores/          # Pinia state management
├── router/          # Vue Router configuration
├── types/           # TypeScript interfaces
└── mock/            # Mock data (USE_MOCK flag in api/index.ts)
```

**Key patterns:**
- API toggle: Set `USE_MOCK = false` in `api/index.ts` to use real backend
- Auth flow: Login → store JWT → axios interceptor adds to all requests
- Route guard: Redirects to /login if no token in localStorage

### Data Flow
1. User triggers build → POST /api/builds → Creates DB record with status='pending'
2. `startBuild()` runs async → Updates status to 'running' → Executes git clone + gradle build
3. Logs written to DB via `logAndExec()` → Frontend polls GET /api/builds/:id/logs
4. Build completes → Status updated to 'success' or 'failed'

### Database Schema (Prisma + SQLite)
- **User**: username, password (bcrypt hashed)
- **Project**: name, gitUrl, branch, gradleTask, description
- **Build**: projectId, status, gitCommit, startedAt, finishedAt, apkPath
- **BuildLog**: buildId, logType (stdout/stderr), content, timestamp

## Important Notes

### Security Considerations
- Shell command injection risk in `services/build.ts` - git URLs and paths are not sanitized
- JWT secret defaults to 'secret' if not in .env - must set in production
- No rate limiting on API endpoints
- No input validation on API requests

### Field Naming Convention
- **Backend DB/code**: camelCase (projectId, gitUrl, createdAt)
- **Frontend/API**: snake_case (project_id, git_url, created_at)
- Conversion handled by `toSnakeCase()` utility in backend responses

### Configuration
- Backend: `.env` file (DATABASE_URL, JWT_SECRET, PORT)
- System settings: Stored in-memory via `config.ts` (workspaceDir, jdkPath, androidSdkPath)
- Frontend API base URL: Hardcoded to `http://localhost:3000/api`

### Testing
- Test user: admin / admin123 (created via POST /api/auth/register)
- Frontend tests: Vitest + Vue Test Utils (minimal coverage currently)
- Backend: No tests implemented yet

## Common Tasks

**Add new API endpoint:**
1. Create route in `backend/src/routes/`
2. Add to `backend/src/index.ts` via `app.use()`
3. Add API method in `frontend/src/api/index.ts`
4. Use `toSnakeCase()` for response transformation

**Modify database schema:**
1. Edit `backend/prisma/schema.prisma`
2. Run `npm run db:push` to sync
3. Prisma Client auto-regenerates

**Add new page:**
1. Create Vue component in `frontend/src/views/`
2. Add route in `frontend/src/router/index.ts`
3. Update navigation if needed

## Known Issues
- Build logs not real-time (polling required, WebSocket not implemented)
- No APK file download functionality
- No build queue management (concurrent builds may overload)
- Git operations lack proper error handling and input validation
