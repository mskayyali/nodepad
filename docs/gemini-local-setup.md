# Gemini (Local) Provider Setup

The **Gemini (Local)** provider lets you use your existing Gemini CLI OAuth tokens to access Google's Gemini models at no additional cost. This works with Google One AI Ultra and Gemini Code Assist subscriptions.

## Prerequisites

1. Install [Gemini CLI](https://github.com/google-gemini/gemini-cli):
   ```bash
   npm install -g @google/gemini-cli
   ```

2. Authenticate with your Google account:
   ```bash
   gemini auth login
   ```

## Setup

1. Copy the Gemini CLI credential file into the nodepad project root:

```bash
cp ~/.gemini/oauth_creds.json ./gemini-creds.json
```

2. Create a `.env.local` file with the Gemini CLI OAuth client credentials.

   Find the client ID and secret in the Gemini CLI source:
   ```bash
   grep -A1 "OAUTH_CLIENT_ID\|OAUTH_CLIENT_SECRET" \
     $(npm root -g)/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/code_assist/oauth2.js
   ```

   Then create `.env.local`:
   ```
   GEMINI_OAUTH_CLIENT_ID=<client_id from above>
   GEMINI_OAUTH_CLIENT_SECRET=<client_secret from above>
   ```

Both files are in `.gitignore` and will never be committed.

### Default credential location on macOS

```
~/.gemini/oauth_creds.json
```

## Usage

1. Open nodepad (`npm run dev`)
2. Open the sidebar (menu button, top-left) → **Settings**
3. Select **Gemini (Local)** as the provider
4. Choose a model and save

## Troubleshooting

- **"Credentials not found"** — Run `cp ~/.gemini/oauth_creds.json ./gemini-creds.json` from the project root.
- **"Token expired"** — Run `gemini auth login` in your terminal, then re-copy the credential file.
- **"Account not eligible"** — Your Google account may not have an active Gemini Code Assist or Google One AI Ultra subscription.
