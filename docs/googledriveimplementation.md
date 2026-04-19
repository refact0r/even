# Google Drive Storage Integration — Setup Guide

**Scope:** This document covers setting up Google Drive as a storage backend for a web app. Focus is on **sending data for storage** — uploading, updating, and organizing files the app creates. Reading/browsing arbitrary user files is out of scope.

**Audience:** Web developers wiring Drive into a frontend (vanilla JS, React, etc.). No backend required.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Google Cloud Console Setup](#2-google-cloud-console-setup)
3. [Scope Selection](#3-scope-selection)
4. [Client-Side Library Setup](#4-client-side-library-setup)
5. [Authentication Flow](#5-authentication-flow)
6. [Uploading Data — Three Methods](#6-uploading-data--three-methods)
7. [File Organization Patterns](#7-file-organization-patterns)
8. [Updating Existing Files](#8-updating-existing-files)
9. [Token Lifecycle & Error Handling](#9-token-lifecycle--error-handling)
10. [Production Checklist](#10-production-checklist)
11. [Reference: Key Endpoints](#11-reference-key-endpoints)

---

## 1. Architecture Overview

A storage-focused Drive integration has three moving parts:

| Component | Purpose | Source |
|---|---|---|
| Google Identity Services (GIS) | OAuth 2.0 token acquisition | `https://accounts.google.com/gsi/client` |
| Google API Client (`gapi`) | Drive REST wrapper | `https://apis.google.com/js/api.js` |
| Drive API v3 | File operations | Called via `gapi.client.drive` |

**Data flow for storage:**

```
User gesture → GIS token request → Access token
                                         ↓
App data (JSON/blob) → gapi.client.request → Drive API → File stored
                                         ↑
                              Access token in Authorization header
```

**No backend needed.** All calls go directly from browser to Google. CORS is pre-approved for documented endpoints.

---

## 2. Google Cloud Console Setup

One-time setup. Takes ~10 minutes.

### 2.1 Create a project

1. Visit `https://console.cloud.google.com`
2. Top bar → project dropdown → **New Project**
3. Name it (e.g., "my-app-drive"), no organization needed for personal use
4. Wait for creation, then select the project

### 2.2 Enable the Drive API

1. Left nav → **APIs & Services** → **Library**
2. Search "Google Drive API" → click result → **Enable**

### 2.3 Configure OAuth consent screen

1. Left nav → **APIs & Services** → **OAuth consent screen**
2. User type: **External** (unless using Google Workspace)
3. Fill in:
   - App name
   - User support email
   - Developer contact email
4. **Scopes** step: add the scope you'll use (see [Section 3](#3-scope-selection))
5. **Test users** step: add your own email and any testers — required while in "Testing" status
6. Save and return to dashboard

> **Note:** Apps in "Testing" status are capped at 100 users and tokens expire every 7 days. For production, you must go through verification. If you use only non-sensitive scopes (like `drive.file`), verification is lightweight.

### 2.4 Create OAuth 2.0 credentials

1. Left nav → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Add **Authorized JavaScript origins**:
   - `http://localhost:5173` (or whatever your dev port is)
   - `http://localhost:3000`
   - Your production domain (e.g., `https://myapp.com`)
5. **Authorized redirect URIs** — leave empty; GIS token flow doesn't use redirects
6. Save. Copy the **Client ID** — you'll need it in code.

### 2.5 (Optional) Create an API key

Only needed if you also use the Picker API. For pure storage, skip.

---

## 3. Scope Selection

**For storage use cases, pick the narrowest scope that fits.** This determines how much friction users face and whether you need Google verification.

| Scope | Access | Verification | Best For |
|---|---|---|---|
| `drive.file` | Only files your app creates or user opens via Picker | **None** (non-sensitive) | Saving user-generated app data — **recommended default** |
| `drive.appdata` | Hidden per-app folder, invisible in Drive UI | None | App config, state, backups users shouldn't see |
| `drive.readonly` | Read all user files | Required | Browsing/importing — not storage |
| `drive` | Full read/write | Required (restricted) | Only if you're building a Drive client |

### The two scopes that matter for storage

**`https://www.googleapis.com/auth/drive.file`**
- User grants access. Your app can create files. It can later read/update only files it created.
- Can't see the user's existing files. This is a feature, not a limitation.
- Files appear in the user's Drive normally and are user-visible.

**`https://www.googleapis.com/auth/drive.appdata`**
- Creates a special folder (`appDataFolder`) that only your app can see.
- Perfect for settings, cache, versioned backups.
- Doesn't count against the user's "recent files" or clutter their Drive.
- Deleted automatically if the user uninstalls/revokes your app.

You can request both at once: `"drive.file drive.appdata"`.

---

## 4. Client-Side Library Setup

### 4.1 Load the scripts

In your HTML `<head>`:

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
<script src="https://apis.google.com/js/api.js" async defer></script>
```

Both must finish loading before any API calls. Wait for the scripts in your init code:

```javascript
function waitForGoogleLibs() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.google?.accounts?.oauth2 && window.gapi) {
        resolve();
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}
```

### 4.2 Initialize the Drive client

```javascript
const CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

async function initDriveClient() {
  await waitForGoogleLibs();

  // Load the 'client' module of gapi
  await new Promise((resolve) => gapi.load("client", resolve));

  // Initialize with the Drive discovery document
  await gapi.client.init({
    discoveryDocs: [DISCOVERY_DOC],
  });
}
```

Call `initDriveClient()` once at app startup.

---

## 5. Authentication Flow

GIS uses a **token-based model**, not the old redirect flow. You request a token, get back an access token (good for ~1 hour), and attach it to every Drive call.

### 5.1 Create the token client

```javascript
let tokenClient;
let accessToken = null;

function setupAuth() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) {
        console.error("Auth failed:", response);
        return;
      }
      accessToken = response.access_token;
      gapi.client.setToken({ access_token: accessToken });
      onAuthenticated(); // your hook — enable upload UI, etc.
    },
  });
}
```

### 5.2 Trigger sign-in

Must be called from a **user gesture** (button click). Browsers block popups otherwise.

```javascript
function signIn() {
  // Empty prompt = silent if already consented, otherwise show consent
  tokenClient.requestAccessToken({ prompt: "consent" });
}

// On subsequent sessions, skip the consent screen
function refreshToken() {
  tokenClient.requestAccessToken({ prompt: "" });
}
```

### 5.3 Sign out

```javascript
function signOut() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      gapi.client.setToken(null);
    });
  }
}
```

---

## 6. Uploading Data — Three Methods

Drive supports three upload types. Pick based on file size and whether you need metadata.

| Method | Size Limit | Use When |
|---|---|---|
| Simple | 5 MB | Body only, no custom name/folder/etc. |
| Multipart | 5 MB | Body + metadata in one request — **most common for JSON/state** |
| Resumable | 5 TB | Large files or unreliable networks |

### 6.1 Simple upload (rare)

```javascript
async function simpleUpload(content, mimeType = "text/plain") {
  return gapi.client.request({
    path: "/upload/drive/v3/files",
    method: "POST",
    params: { uploadType: "media" },
    headers: { "Content-Type": mimeType },
    body: content,
  });
}
```

Creates a file named "Untitled". Almost never what you want — use multipart.

### 6.2 Multipart upload (default for app state/JSON)

```javascript
async function uploadFile({ name, content, mimeType = "application/json", parents = [] }) {
  const metadata = {
    name,
    mimeType,
    ...(parents.length && { parents }), // folder ID(s)
  };

  const boundary = "-------" + Math.random().toString(36).slice(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const body =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    (typeof content === "string" ? content : JSON.stringify(content)) +
    closeDelim;

  const response = await gapi.client.request({
    path: "/upload/drive/v3/files",
    method: "POST",
    params: { uploadType: "multipart", fields: "id, name, modifiedTime" },
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  return response.result; // { id, name, modifiedTime }
}
```

**Example usage:**

```javascript
const state = { entries: [...], version: 3, lastUpdated: Date.now() };

const file = await uploadFile({
  name: "app-state.json",
  content: state,
  mimeType: "application/json",
});

console.log("Stored as", file.id);
```

### 6.3 Resumable upload (large files)

Two-step: initiate session, then PUT bytes. Handles interruptions.

```javascript
async function resumableUpload({ name, blob, mimeType, parents = [] }) {
  // Step 1: initiate
  const initRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": blob.size.toString(),
      },
      body: JSON.stringify({ name, mimeType, parents }),
    }
  );

  const uploadUrl = initRes.headers.get("Location");

  // Step 2: upload bytes (can be chunked for progress / resumption)
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: blob,
  });

  return uploadRes.json();
}
```

For chunked uploads with progress bars and retry-on-failure, split the blob and use `Content-Range` headers. See the [official resumable upload docs](https://developers.google.com/drive/api/guides/manage-uploads#resumable) when you need that.

### 6.4 Using `appDataFolder`

For hidden app storage, set `parents: ["appDataFolder"]` and make sure you requested the `drive.appdata` scope.

```javascript
const file = await uploadFile({
  name: "config.json",
  content: userConfig,
  parents: ["appDataFolder"],
});
```

---

## 7. File Organization Patterns

### 7.1 Create a dedicated app folder (visible)

With `drive.file`, your app can only see files it created — including folders. Create one at first run and store its ID.

```javascript
async function ensureAppFolder(folderName = "My App Data") {
  // Search for existing folder we created
  const res = await gapi.client.drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (res.result.files.length) {
    return res.result.files[0].id;
  }

  // Create if missing
  const created = await gapi.client.drive.files.create({
    resource: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  return created.result.id;
}
```

Store the returned folder ID in `localStorage` to skip the lookup on subsequent loads. Verify it still exists on app start (user might have deleted it).

### 7.2 Hidden app storage (recommended for config/state)

Use `appDataFolder` — no folder creation needed, no user visibility, zero clutter.

```javascript
async function saveConfig(config) {
  return uploadFile({
    name: "config.json",
    content: config,
    parents: ["appDataFolder"],
  });
}

async function listAppDataFiles() {
  const res = await gapi.client.drive.files.list({
    spaces: "appDataFolder",
    fields: "files(id, name, modifiedTime)",
    pageSize: 100,
  });
  return res.result.files;
}
```

---

## 8. Updating Existing Files

Two patterns depending on whether you want version history.

### 8.1 Overwrite in place (no history)

PATCH the file's media. Same file ID, new contents.

```javascript
async function updateFileContent(fileId, content, mimeType = "application/json") {
  return gapi.client.request({
    path: `/upload/drive/v3/files/${fileId}`,
    method: "PATCH",
    params: { uploadType: "media", fields: "id, modifiedTime" },
    headers: { "Content-Type": mimeType },
    body: typeof content === "string" ? content : JSON.stringify(content),
  });
}
```

### 8.2 Update metadata + content together

Multipart PATCH.

```javascript
async function updateFileFull(fileId, { name, content, mimeType }) {
  const metadata = { name, mimeType };
  const boundary = "-------" + Math.random().toString(36).slice(2);

  const body =
    `\r\n--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    (typeof content === "string" ? content : JSON.stringify(content)) +
    `\r\n--${boundary}--`;

  return gapi.client.request({
    path: `/upload/drive/v3/files/${fileId}`,
    method: "PATCH",
    params: { uploadType: "multipart" },
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}
```

### 8.3 Versioned writes (keep history)

Don't update — create a new file each time with a timestamp in the name, inside your app folder. Optionally delete or archive old ones on a retention policy.

```javascript
async function saveSnapshot(data, folderId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return uploadFile({
    name: `snapshot-${timestamp}.json`,
    content: data,
    parents: [folderId],
  });
}
```

---

## 9. Token Lifecycle & Error Handling

### 9.1 Access tokens expire

Access tokens last ~1 hour. **GIS does not issue refresh tokens to browsers** (security posture). When a call returns 401, silently re-request:

```javascript
async function withAuth(apiCall) {
  try {
    return await apiCall();
  } catch (err) {
    if (err.status === 401 || err.result?.error?.code === 401) {
      await new Promise((resolve) => {
        tokenClient.callback = (resp) => {
          accessToken = resp.access_token;
          gapi.client.setToken({ access_token: accessToken });
          resolve();
        };
        tokenClient.requestAccessToken({ prompt: "" }); // silent
      });
      return apiCall(); // retry once
    }
    throw err;
  }
}

// Usage
const file = await withAuth(() => uploadFile({ name: "x.json", content: data }));
```

Reset `tokenClient.callback` back to its default afterward if you're using a single callback for normal auth.

### 9.2 Common error codes

| Code | Meaning | Action |
|---|---|---|
| 401 | Token expired/invalid | Silent re-auth, retry |
| 403 | Quota exceeded or permission denied | Check scopes; back off if quota |
| 404 | File deleted or not yours | Fall back to re-create |
| 429 | Rate limited | Exponential backoff |
| 5xx | Google-side | Retry with backoff |

### 9.3 Rate limits

Drive API default: 1,000 requests per 100 seconds per user. Batch reads when possible; for writes, serialize if you're pushing many updates.

---

## 10. Production Checklist

Before shipping:

- **OAuth verification** — required to leave "Testing" status if using sensitive scopes. `drive.file` and `drive.appdata` are non-sensitive, so verification is minimal.
- **Privacy policy URL** — required by Google consent screen
- **Terms of service URL** — required for verification
- **Domain verification** — prove you own the origins in Search Console
- **Brand review** — logo, scope justification (if sensitive scopes)
- **Error UI** — specifically handle revoked access, network failures, quota exhaustion
- **Offline queue** — buffer writes locally (IndexedDB) when offline; flush when reconnected
- **Deduplication** — before uploading, check if a file with that name already exists in your folder; otherwise you'll accumulate duplicates on retry
- **Content-Type accuracy** — Drive uses this for indexing and preview. `application/json` for structured data, not `text/plain`.
- **`fields` parameter on every call** — Drive returns minimal data by default. Always specify what you need. Missing this causes "why is `modifiedTime` undefined" bugs.
- **Separate dev and prod OAuth clients** — different authorized origins, different consent screens

---

## 11. Reference: Key Endpoints

All under `https://www.googleapis.com/drive/v3/` except uploads.

| Operation | Endpoint | Method |
|---|---|---|
| List files | `/files` | GET |
| Get metadata | `/files/{fileId}` | GET |
| Download content | `/files/{fileId}?alt=media` | GET |
| Create (metadata only) | `/files` | POST |
| Upload (simple) | `/upload/drive/v3/files?uploadType=media` | POST |
| Upload (multipart) | `/upload/drive/v3/files?uploadType=multipart` | POST |
| Upload (resumable init) | `/upload/drive/v3/files?uploadType=resumable` | POST |
| Update metadata | `/files/{fileId}` | PATCH |
| Update content | `/upload/drive/v3/files/{fileId}?uploadType=media` | PATCH |
| Delete | `/files/{fileId}` | DELETE |
| Trash (soft delete) | `/files/{fileId}` with `{trashed: true}` | PATCH |

### Query parameters worth knowing

- `fields` — comma-separated projection (`id,name,modifiedTime`). Use `files(id,name)` for list responses.
- `q` — search query. E.g., `mimeType='application/json' and trashed=false`.
- `spaces` — `drive` (default), `appDataFolder`, or `photos`.
- `pageSize`, `pageToken` — pagination.
- `orderBy` — `modifiedTime desc`, `name`, `createdTime`, etc.

### Official documentation

- Drive API v3 reference: `https://developers.google.com/drive/api/reference/rest/v3`
- GIS token flow: `https://developers.google.com/identity/oauth2/web/guides/use-token-model`
- Upload guide: `https://developers.google.com/drive/api/guides/manage-uploads`
- appDataFolder: `https://developers.google.com/drive/api/guides/appdata`
- OAuth scope reference: `https://developers.google.com/identity/protocols/oauth2/scopes#drive`

---

## Appendix: Minimal end-to-end example

A single-file reference implementation for JSON storage in `appDataFolder`.

```javascript
// drive-storage.js
const CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

let tokenClient;
let accessToken = null;
let initPromise = null;

export async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await waitForLibs();
    await new Promise((r) => gapi.load("client", r));
    await gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: () => {}, // set per request
    });
  })();
  return initPromise;
}

export function signIn() {
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(resp);
      accessToken = resp.access_token;
      gapi.client.setToken({ access_token: accessToken });
      resolve();
    };
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

export async function save(filename, data) {
  const existing = await findByName(filename);
  const payload = JSON.stringify(data);

  if (existing) {
    return gapi.client.request({
      path: `/upload/drive/v3/files/${existing.id}`,
      method: "PATCH",
      params: { uploadType: "media" },
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
  }

  const boundary = "-------" + Math.random().toString(36).slice(2);
  const metadata = { name: filename, parents: ["appDataFolder"] };
  const body =
    `\r\n--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    payload +
    `\r\n--${boundary}--`;

  return gapi.client.request({
    path: "/upload/drive/v3/files",
    method: "POST",
    params: { uploadType: "multipart" },
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

export async function load(filename) {
  const file = await findByName(filename);
  if (!file) return null;
  const res = await gapi.client.drive.files.get({
    fileId: file.id,
    alt: "media",
  });
  return typeof res.body === "string" ? JSON.parse(res.body) : res.body;
}

async function findByName(name) {
  const res = await gapi.client.drive.files.list({
    spaces: "appDataFolder",
    q: `name='${name}' and trashed=false`,
    fields: "files(id, name)",
    pageSize: 1,
  });
  return res.result.files[0] || null;
}

function waitForLibs() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.google?.accounts?.oauth2 && window.gapi) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}
```

**Usage:**

```javascript
import { init, signIn, save, load } from "./drive-storage.js";

await init();
document.getElementById("connect").onclick = async () => {
  await signIn();
  await save("state.json", { entries: [...], version: 1 });
  const loaded = await load("state.json");
  console.log(loaded);
};
```