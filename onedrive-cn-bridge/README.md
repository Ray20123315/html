# OneDrive CN Bridge PoC

Cloudflare Worker proxy for large-file upload/download to OneDrive through Microsoft Graph.

## Current deployment

- Worker: `onedrive-cn-bridge`
- workers.dev host: `https://onedrive-cn-bridge.ray20123315.workers.dev`
- KV binding: `STATE`
- Upload chunk size: 10 MiB
- Upload uses Microsoft Graph `createUploadSession`
- Download uses short-lived tickets plus HTTP Range passthrough
- Large request/response bodies are streamed; the Worker does not buffer whole files in memory.

## Required secrets

Do **not** commit these values:

- `ACCESS_KEY`
- `MS_CLIENT_ID`
- `MS_CLIENT_SECRET`

`MS_TENANT` defaults to `common`.

## Microsoft Entra setup

Create an app registration and add this redirect URI:

`https://onedrive-cn-bridge.ray20123315.workers.dev/auth/callback`

Delegated scopes used by this PoC:

- `offline_access`
- `Files.ReadWrite`
- `User.Read`

After the three secrets are set, request an authorization URL:

```bash
curl -X POST \
  -H "Authorization: Bearer <ACCESS_KEY>" \
  https://onedrive-cn-bridge.ray20123315.workers.dev/api/auth/url
```

Open the returned URL and complete Microsoft consent.

## API

### Health

`GET /health`

### Status

`GET /api/status`

Requires:

`Authorization: Bearer <ACCESS_KEY>`

### List files

`GET /api/files`

### Start upload

`POST /api/upload/start`

JSON body:

```json
{"name":"large.bin","size":10737418240}
```

Response includes `uploadId` and `chunkSize`.

### Upload chunk

`PUT /api/upload/{uploadId}`

Required headers:

- `Content-Range: bytes START-END/TOTAL`
- browser/runtime-provided `Content-Length`

Each chunk must be smaller than 60 MiB. This deployment uses 10 MiB chunks.

### Upload status

`GET /api/upload/{uploadId}/status`

### Create download ticket

`POST /api/download-ticket/{driveItemId}`

Response:

```json
{"ok":true,"url":"/d/<ticket>","expiresIn":3600}
```

### Download

`GET /d/{ticket}`

`Range` and `If-Range` are forwarded to OneDrive so resumable downloads can return `206 Partial Content`.

## Security

The Microsoft refresh/access tokens and upload-session URLs stay in Cloudflare KV / Worker-side state. They are not returned to end users. Download tickets expire after one hour.

This is a PoC. Before public production use, add rate limiting, stronger user authentication, upload quotas, audit logging, abuse controls, and explicit file/folder authorization.
