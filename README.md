# Codetorch Messages API

Simple REST API to store and retrieve messages used by a Codetorch block project (network extension).

## Install

```
npm install
```

## Run

```
npm start
```

## Deploying to Vercel

This project includes serverless endpoints in the `api/` directory for easy Vercel deployment.

- Deploy with the Vercel CLI:

```bash
npm install -g vercel
vercel login
vercel --prod
```

- The API will be available at `https://<your-deploy>/api/messages` or at `/messages` per `vercel.json` routes.

Important: Vercel serverless functions run in ephemeral environments. The included JSON-backed DB stores data in the temporary filesystem (by default `/tmp/messages.json` on Vercel) and is not persistent across cold starts or redeploys — this will appear to "clear" frequently. When running locally (not on Vercel) the JSON DB is persisted to `messages.json` in the project root.

For production use, use an external database (Supabase, PlanetScale, Firebase, Vercel KV, etc.). This project supports Supabase/Postgres via the `DATABASE_URL` environment variable.

Locally set `DATABASE_URL` (do not commit it) before starting the server, or set it in Vercel's dashboard as a secret environment variable.

Example local run (PowerShell):

```powershell
$env:DATABASE_URL = "postgresql://..."
npm start
```

On Vercel: add `DATABASE_URL` in Project Settings → Environment Variables.

Warning: Never commit your database connection string to source control. Keep secrets in environment variables or Vercel secrets.

## Endpoints

- `GET /messages` — returns all messages
- `POST /messages` — create a new message. JSON body example:

GET /messages options:

- `?q=term` or `?filter=term` — filter by author or content (case-insensitive)
- `?since=<id>` — return messages with `id` greater than given id
- `?offset=<n>&limit=<m>` — pagination
- `?full=true` or `?raw=true` — return full message objects instead of formatted strings

POST /messages example JSON body:

```json
{
  "author": "Alice",
  "content": "Hello from Codetorch block",
  "blockId": "block-123"
}
```

## Notes

- Database file `messages.db` will be created in the project root.
- If you want auto-reload in development, install `nodemon` and run `npm run dev`.
