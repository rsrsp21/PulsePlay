# Pulse Play

Pulse Play is a live cricket second-screen experience implemented as a single Next.js application inside `frontend/`. Fans can sign in, follow live match state, make short-window prediction picks, react to key moments, and chat in a shared room while earning Pulse Points.

## What It Does

- Shows a live cricket dashboard powered by Cricbuzz match discovery and live score parsing
- Rotates prediction questions every few balls with a configurable answer window
- Awards points for correct picks and interactive actions like cheering and moment rating
- Surfaces commentary-driven match moments for fans to rate
- Provides a live room chat experience for signed-in players
- Supports switching between live matches when multiple games are available
- Uses graceful fallback state when external APIs or Firebase credentials are unavailable

## Tech Stack

- Next.js App Router (Next.js 16)
- React 19
- Custom Vanilla CSS with glassmorphism-inspired UI styling
- Next.js API routes for server-side behavior
- Firebase Authentication for Email/Password sign-in
- Firebase Realtime Database / Firestore fallback for state persistence
- Cricbuzz live score endpoints with fallback handling
- Gemini API support for prediction question generation
- Vercel-friendly deployment structure

## Project Structure

The application lives in `frontend/`.

- `frontend/app/` contains the Next.js UI and API routes
- `frontend/src/App.jsx` contains the client-side live room experience, data polling, and interaction handlers
- `frontend/src/components/` contains UI subcomponents for dashboard, picks, timeline, chat, and scorecard
- `frontend/lib/pulseplay.js` contains match discovery, live score parsing, prediction round logic, chat, and points handling
- `frontend/lib/firebaseAdmin.js` handles Firebase Admin initialization and request authentication
- `frontend/src/firebaseClient.js` handles Firebase web auth on the browser

## Main User Flows

1. View the current live match state and score summary
2. Sign in or create an account with Firebase Authentication
3. Join the live room and send chat messages
4. Answer Pulse Pick questions during active pick windows
5. Rate notable match moments
6. Switch to another live match if available

## API Routes

The frontend exposes backend behavior through serverless API routes:

- `GET /api/state` returns the current active match state and commentary summary
- `GET /api/live-matches` discovers currently live Cricbuzz fixtures
- `GET /api/moments` returns recent commentary-based moments
- `GET /api/picks` returns the current prediction rounds and any user selections
- `GET /api/chat` returns current live room chat messages
- `POST /api/submit-pick` records a user prediction
- `POST /api/submit-chat` stores a room message
- `POST /api/rate-moment` records a moment rating
- `POST /api/trigger-boundary-cheer` updates cheer/sentiment state
- `POST /api/set-active-match` switches the active match
- `POST /api/vote-drs` supports fan DRS polling interactions

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

### Other Commands

```bash
npm run build
npm run start
npm run lint
```

## Environment Variables

Create `frontend/.env.local` for local development.

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
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com/
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# Optional alternative service account format
FIREBASE_SERVICE_ACCOUNT_BASE64=base64-encoded-service-account-json
```

Notes:

- If `GEMINI_API_KEY` is missing, pick questions fall back to local logic/templates
- If Firebase Admin credentials are missing, server-side state falls back to in-memory persistence
- Firebase client authentication requires the `NEXT_PUBLIC_FIREBASE_*` variables
- The app also supports `FIREBASE_SERVICE_ACCOUNT_BASE64` for server-side service account configuration

## Deployment

The frontend is designed to deploy from the `frontend/` directory on Vercel.

## Architecture & System Design

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the overall app flow, backend responsibilities, and state handling.

## License

No license file is included in this repository. Add one if you plan to distribute or open-source the project.
