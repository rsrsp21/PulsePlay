# Pulse Play Vercel Deployment

Pulse Play is now a single Next.js app:

- UI lives in `frontend/src`
- Next pages live in `frontend/app`
- API routes live in `frontend/app/api`
- Shared live cricket and Pulse Pick Agent logic lives in `frontend/lib/pulseplay.js`

## Environment Variables

Add these in Vercel Project Settings > Environment Variables:

```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
CRICBUZZ_MATCH_ID=152141
PULSE_PICK_WINDOW_BALLS=3
PULSE_PICK_WINDOW_SECONDS=45
PULSE_PICK_REWARD_POINTS=50

NEXT_PUBLIC_FIREBASE_API_KEY=your-web-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-web-app-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_DATABASE_URL=https://pulseplay-60bb6-default-rtdb.firebaseio.com/
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Firebase web variables power login. Firebase Admin variables let API routes verify users and store rounds, submissions, chat, and points in Realtime Database. Without Admin variables, the app falls back to server memory.

## Deploy With Vercel CLI

From the repo root:

```bash
cd frontend
npm install
npm run build
npx vercel --prod
```

If Vercel asks for project settings, use:

- Framework preset: Next.js
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `.next`

If you deploy with the CLI, run it from `frontend/`:

```bash
cd frontend
npx vercel --prod
```

## Storage Note

Realtime Database is used when Firebase Admin env vars and `FIREBASE_DATABASE_URL` are configured. If they are missing, the app uses server memory for live rounds, chat, and points, which is fine for demos but not durable across serverless cold starts.

For production durability, add one Vercel-native store:

- Vercel KV / Upstash Redis for picks, submissions, chat, and points
- or Vercel Postgres for relational scoring history
