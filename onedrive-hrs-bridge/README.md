# HRS Drive — Cloudflare ↔ OneDrive

A Cloudflare Worker UI and streaming bridge scoped to a single OneDrive root folder: `/HRS`.

## Security boundary

The Worker never lists the OneDrive root. All file APIs are rooted at `/HRS`.

For item-ID operations (delete, download, share), the Worker resolves the target with Microsoft Graph and verifies its `parentReference.path` is `/drive/root:/HRS` or a descendant before proceeding. The HRS root itself cannot be deleted.

The public page contains no file metadata until a valid `ACCESS_KEY` is supplied. The key is stored only in browser `sessionStorage`.

## Features

- Dark glass UI based on the visual language of `hf-cf-upload-poc-20260929`
- Nested folder browsing
- Folder creation
- 10 MiB sequential Microsoft Graph upload-session chunks
- Large-file streaming through Cloudflare without buffering the whole file
- Download tickets with Range / resume support
- Delete files or folders inside HRS
- Create anonymous read-only OneDrive sharing links for HRS items
- Server-side path and item-ID sandboxing

## Cloudflare Worker

Deployed as:

`onedrive-cn-files.ray20123315.workers.dev`

## Required secrets

Set these manually in Cloudflare. Do not commit them:

- `ACCESS_KEY`
- `MS_CLIENT_ID`
- `MS_CLIENT_SECRET`

Non-secret bindings are already configured:

- `ROOT_FOLDER=HRS`
- `MS_TENANT=common`
- `STATE` → existing KV namespace

An older test-only `PORTAL_KEY` binding may still exist. The HRS Worker does not read it.

## Microsoft redirect URI

Register this exact Web redirect URI on the Microsoft Entra application:

`https://onedrive-cn-files.ray20123315.workers.dev/auth/callback`

Delegated scopes used:

- `offline_access`
- `Files.ReadWrite`
- `User.Read`

If the existing KV token belongs to the same Microsoft app, adding a new client secret for that same app should allow token refresh. If the client ID changes to a different app, reconnect OneDrive from the UI.

## HRS folder

The `/HRS` folder was created in the signed-in personal OneDrive through the connected Microsoft connector. No other OneDrive folders were modified.
