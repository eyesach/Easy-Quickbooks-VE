# Group File Sharing Architecture

## Overview

This document describes how collaborative group file sharing works for the Accounting Journal Calculator. Multiple users can share, edit, and auto-save a single finance document with full version history.

## How It Works

### Current State (Local Only)
```
User opens app → SQLite loaded from IndexedDB → edits → autoSave writes back to IndexedDB
```

### With Group Sync
```
User opens app → pulls latest from server → SQLite loaded → edits → autoSave writes to IndexedDB AND pushes to server
```

## Core Concepts

### 1. Groups
A **group** is a shared document workspace identified by a unique ID. One user creates it, others join by ID (or invite link). All members share the same canonical database file stored on the server.

### 2. Version Snapshots
Every save creates a new **version** — a full snapshot of the SQLite database binary. Each version records:
- `version` — incrementing integer (1, 2, 3...)
- `savedBy` — display name of who saved it
- `savedAt` — ISO timestamp
- `sizeBytes` — size of the database file
- `data` — the full SQLite binary blob

### 3. Optimistic Locking (Conflict Detection)
When you push a save, you include `baseVersion` — the version you last pulled. The server checks:
- If `baseVersion` matches the current server version → save succeeds, version increments
- If someone else saved a newer version → **conflict** — your push is rejected

```
Alice loads v3 → edits
Bob loads v3 → edits → saves v4
Alice tries to save → CONFLICT (server is at v4, Alice's base is v3)
Alice pulls v4 → merges her changes → saves v5
```

### 4. Auto-Pull Polling
While connected, the app polls the server every 30 seconds for new versions. If a remote update is found, the user is notified and can reload.

## Data Flow

```
                    ┌──────────────┐
                    │   Server     │
                    │  (versions)  │
                    └──────┬───────┘
                     push ↑ ↓ pull
              ┌────────────┴────────────┐
              │      SyncService        │
              │  (js/sync.js)           │
              │  - groupId, localVersion│
              │  - push(), pull()       │
              │  - conflict detection   │
              └────────────┬────────────┘
                           │ wraps autoSave
              ┌────────────┴────────────┐
              │      Database           │
              │  (js/database.js)       │
              │  - saveToIndexedDB()    │  ← still works offline
              │  - db.export() → blob   │
              └─────────────────────────┘
```

## API Contract

The server must implement these endpoints. `SyncService.api` is a pluggable adapter — swap between a REST API, Firebase, Supabase, or any backend.

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `createGroup(name)` | group name | `{ groupId, name, createdAt }` | Create a new shared group |
| `joinGroup(groupId, user)` | group ID, username | `{ groupId, name, members, currentVersion }` | Join an existing group |
| `pushVersion(groupId, data)` | group ID, `{ blob, baseVersion, user }` | `{ version }` or throws ConflictError | Save a new version (optimistic lock) |
| `pullLatest(groupId)` | group ID | `{ version, data, savedBy, savedAt }` or null | Get the latest version |
| `getHistory(groupId, limit)` | group ID, max results | `[{ version, savedBy, savedAt, sizeBytes }]` | List version history (newest first) |
| `pullVersion(groupId, ver)` | group ID, version number | `{ version, data, savedBy, savedAt }` | Download a specific historical version |

### REST API Example (if using Express/Node)

```
POST   /api/groups                    → createGroup
POST   /api/groups/:id/join           → joinGroup
POST   /api/groups/:id/versions       → pushVersion
GET    /api/groups/:id/versions/latest → pullLatest
GET    /api/groups/:id/versions        → getHistory
GET    /api/groups/:id/versions/:ver   → pullVersion
```

### ConflictError

When `pushVersion` detects a version mismatch, it must throw/return:
```js
{
    name: 'ConflictError',
    code: 'VERSION_CONFLICT',
    remoteVersion: <current server version>
}
```

## Integration Points

### autoSave Hook
`SyncService.wrapAutoSave(Database)` patches `Database.saveToIndexedDB` to also push to the server after every local save. Local save always happens first — if the remote push fails, the user's work is never lost.

### Loading Remote Data
`SyncService.loadRemoteIntoDatabase(Database)` pulls the latest version and replaces the local database. Called once when joining a group.

### Callbacks
| Callback | Fires When |
|----------|-----------|
| `onRemoteUpdate({ version, data, savedBy, savedAt, previousVersion })` | A pull finds a newer version |
| `onConflict(error)` | A push is rejected due to version mismatch |
| `onStatusChange({ status, message, timestamp })` | Any state change (connected, saved, conflict, error) |

## Conflict Resolution Strategy

For MVP, the simplest approach:
1. Detect conflict (push rejected)
2. Pull the latest version (overwrites local)
3. User's unsaved changes are lost — they re-apply manually

For a better UX later:
1. Detect conflict
2. Save user's current blob as a "local draft"
3. Pull the remote version
4. Show a diff/merge UI or let the user choose which version to keep

## File Structure

```
js/sync.js              — SyncService module (client-side sync logic)
tests/sync.test.html    — Test runner (open in browser)
tests/sync.test.js      — 30+ unit tests with in-memory mock backend
```

## Running Tests

Open `tests/sync.test.html` in a browser. All tests run automatically using an in-memory mock backend (no server needed). Tests cover:
- Group creation and joining
- Push/pull with version tracking
- Conflict detection and resolution
- Version history retrieval
- Multi-user editing scenarios
- Edge cases (empty blobs, large files, rapid saves)

## Future: Backend Options

| Option | Pros | Cons |
|--------|------|------|
| **Supabase** (Postgres + Storage) | Free tier, real-time subscriptions, auth built in | Vendor lock-in |
| **Firebase** (Firestore + Storage) | Real-time sync, generous free tier | Google dependency |
| **Custom Node/Express + S3** | Full control, simple to build | Must host and maintain |
| **Cloudflare Workers + R2** | Edge-deployed, cheap storage | More complex setup |

The `SyncService.api` adapter pattern means you can switch backends without changing any client code.
