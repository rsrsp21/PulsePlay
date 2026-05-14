# Pulse Play

Pulse Play is a live cricket second-screen game room built as a single Next.js app for Vercel.

Fans can join a live room, follow the current Cricbuzz match state, answer AI-generated Pulse Pick questions every 3 balls, react to match moments, and compete for Pulse Points.

## Stack

- Next.js App Router
- React UI
- Next.js API routes
- Cricbuzz live score endpoints
- Firebase Auth and Realtime Database
- Gemini API for Pulse Pick question generation
- Vercel deployment

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Create `frontend/.env.local`:

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
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_DATABASE_URL=https://pulseplay-60bb6-default-rtdb.firebaseio.com/
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

The app still runs without `GEMINI_API_KEY`, but questions use fallback wording. Realtime Database is used when Firebase Admin env vars are present.

## Deploy

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md).
