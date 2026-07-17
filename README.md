# Pulse Play

Pulse Play is a live cricket second-screen experience built as a single Next.js application. Fans can log in, follow the current live match state, make short-window prediction picks, react to key moments, and chat in a shared room while earning Pulse Points.

## What It Does

- Shows a live cricket dashboard powered by Cricbuzz match data
- Rotates prediction questions every 3 balls
- Awards points for correct picks and interactive actions
- Surfaces commentary-driven match moments for fans to rate
- Provides a live room chat experience for signed-in players
- Supports switching between live matches when multiple games are available
- Resilient data-fetching system with automatic mock fallbacks if external APIs block requests
- Secure player profiles with password management and quick-access dropdowns

## Tech Stack

- Next.js App Router (Next.js 16)
- React 18/19
- Custom Vanilla CSS (Glassmorphism aesthetics, CSS variables for robust light/dark mode)
- Next.js API routes (Serverless Functions)
- Firebase Authentication (Email/Password, Profile Management)
- Firebase Realtime Database or Firestore fallback
- Cricbuzz live score endpoints (with graceful degradation/mock fallbacks)
- Gemini API for prediction question generation
- Vercel deployment (Serverless architecture)

## Project Structure

The actual app lives in `frontend/`.

- `frontend/app/` contains the Next.js pages and API routes
- `frontend/src/App.jsx` contains the main client experience and tabbed live room UI
- `frontend/src/components/` contains the dashboard, timeline, picks, fan room, tactical, and header views
- `frontend/lib/pulseplay.js` contains match discovery, live score parsing, prediction round logic, chat, and points handling
- `frontend/lib/firebaseAdmin.js` handles Firebase Admin connectivity on the server
- `frontend/src/firebaseClient.js` handles Firebase sign-in/sign-up in the browser

## Main User Flows

1. View the current live match state and score summary
2. Sign in or create an account with Firebase Authentication
3. Join the live room and submit chats or fan reactions
4. Answer Pulse Pick questions during each 3-ball window
5. Rate notable match moments
6. Switch to another live match if one is available

## API Routes

The app exposes its backend behavior through Next.js API routes:

- `GET /api/state` returns the active match state and a summary commentary line
- `GET /api/live-matches` discovers currently live Cricbuzz fixtures
- `GET /api/moments` returns recent commentary-derived moments
- `GET /api/picks` returns the active or recent prediction rounds
- `POST /api/submit-pick` records a user prediction
- `POST /api/submit-chat` stores a live room message
- `POST /api/rate-moment` records moment feedback
- `POST /api/trigger-boundary-cheer` updates the cheer/sentiment state
- `POST /api/set-active-match` switches the active match
- `POST /api/vote-drs` and `GET /api/chat` are also available for room interaction flows

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

Create `frontend/.env.local` for local development:

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
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com/
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Notes:

- If `GEMINI_API_KEY` is missing, Pulse Pick questions fall back to a local template
- If Firebase Admin variables are missing, the server falls back to in-memory state where possible
- Firebase Auth on the client requires `NEXT_PUBLIC_FIREBASE_*` variables

## Deployment

The app is deployed at [PulsePlay](https://pulseplay-apl.vercel.app).

The project is designed to be deployed from the `frontend` directory on Vercel.

## Architecture & System Design

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a concise overview of the app flow, BFF (Backend-For-Frontend) patterns, and serverless responsibilities.

## License

No license file is included in this repository. Add one if you plan to distribute or open-source the project.
