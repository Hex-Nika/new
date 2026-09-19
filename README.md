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

For production use, use an external database (Supabase, PlanetScale, Firebase, Vercel KV, etc.) and set the relevant environment variables; then update `api/db.js` to connect to that database. If you'd like, I can add a Supabase or Vercel KV integration now.

## Endpoints

- `GET /messages` — returns all messages
- `POST /messages` — create a new message. JSON body example:

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
