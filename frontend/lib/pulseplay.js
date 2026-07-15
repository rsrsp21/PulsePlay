import { FieldValue, getDb, getRealtimeDb } from './firebaseAdmin.js';

const DEFAULT_MATCH_ID = process.env.CRICBUZZ_MATCH_ID || '152141';
const WINDOW_BALLS = Number(process.env.PULSE_PICK_WINDOW_BALLS || 3);
const WINDOW_SECONDS = Number(process.env.PULSE_PICK_WINDOW_SECONDS || 45);
const REWARD_POINTS = Number(process.env.PULSE_PICK_REWARD_POINTS || 50);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const state = globalThis.__pulsePlayState || {
    activeGuid: null,
    liveMatches: [],
    matchCache: new Map(),
    rounds: new Map(),
    submissions: new Map(),
    userPoints: new Map(),
    chat: [],
    momentRatings: new Map(),
    sentimentAngle: 0,
    lastDiscoveryAt: 0,
};

globalThis.__pulsePlayState = state;

function encodeKey(value) {
    return encodeURIComponent(String(value)).replace(/\./g, '%2E');
}

function cleanForFirestore(value) {
    if (Array.isArray(value)) return value.map(cleanForFirestore);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, item]) => item !== undefined)
                .map(([key, item]) => [key, cleanForFirestore(item)])
        );
    }
    return value;
}

async function getRound(roundId) {
    const rtdb = getRealtimeDb();
    if (rtdb) {
        const snapshot = await rtdb.ref(`pulse_pick_rounds/${encodeKey(roundId)}`).get();
        return snapshot.exists() ? snapshot.val() : null;
    }
    const db = getDb();
    if (!db) return state.rounds.get(roundId);
    const snapshot = await db.collection('pulse_pick_rounds').doc(roundId).get();
    return snapshot.exists ? snapshot.data() : null;
}

async function saveRound(round) {
    const rtdb = getRealtimeDb();
    if (rtdb) {
        await rtdb.ref(`pulse_pick_rounds/${encodeKey(round.id)}`).update(cleanForFirestore(round));
        return round;
    }
    const db = getDb();
    if (!db) {
        state.rounds.set(round.id, round);
        return round;
    }
    await db.collection('pulse_pick_rounds').doc(round.id).set(cleanForFirestore(round), { merge: true });
    return round;
}

async function saveSubmission(submission) {
    const rtdb = getRealtimeDb();
    const db = getDb();
    const id = `${submission.pickId}:${submission.userId}`;
    if (rtdb) {
        await rtdb.ref(`pulse_pick_submissions/${encodeKey(id)}`).update(cleanForFirestore(submission));
        return submission;
    }
    if (!db) {
        state.submissions.set(id, submission);
        return submission;
    }
    await db.collection('pulse_pick_submissions').doc(id).set(cleanForFirestore(submission), { merge: true });
    return submission;
}

async function listSubmissions(pickId) {
    const rtdb = getRealtimeDb();
    if (rtdb) {
        // Submissions are keyed by `${pickId}:${userId}`, so a key-range query
        // finds a round's submissions without needing an .indexOn rule.
        const prefix = encodeKey(`${pickId}:`);
        const snapshot = await rtdb.ref('pulse_pick_submissions')
            .orderByKey()
            .startAt(prefix)
            .endAt(prefix + '\uf8ff')
            .get();
        return snapshot.exists() ? Object.values(snapshot.val()) : [];
    }
    const db = getDb();
    if (!db) return Array.from(state.submissions.values()).filter((item) => item.pickId === pickId);
    const snapshot = await db.collection('pulse_pick_submissions').where('pickId', '==', pickId).get();
    return snapshot.docs.map((doc) => doc.data());
}

export async function getSubmission(pickId, userId) {
    if (!userId) return null;
    const rtdb = getRealtimeDb();
    const db = getDb();
    const id = `${pickId}:${userId}`;
    if (rtdb) {
        const snapshot = await rtdb.ref(`pulse_pick_submissions/${encodeKey(id)}`).get();
        return snapshot.exists() ? snapshot.val() : null;
    }
    if (!db) return state.submissions.get(id) || null;
    const snapshot = await db.collection('pulse_pick_submissions').doc(id).get();
    return snapshot.exists ? snapshot.data() : null;
}

async function awardPoints(userId, userName, points) {
    const rtdb = getRealtimeDb();
    if (rtdb) {
        const ref = rtdb.ref(`pulse_play_users/${encodeKey(userId)}`);
        const result = await ref.transaction((current) => ({
            ...(current || {}),
            userId,
            name: userName,
            pulsePoints: (current?.pulsePoints || 0) + points,
            updatedAt: new Date().toISOString(),
        }));
        return result.snapshot.val()?.pulsePoints || 0;
    }
    const db = getDb();
    if (!db) {
        const next = (state.userPoints.get(userId) || 0) + points;
        state.userPoints.set(userId, next);
        return next;
    }
    const ref = db.collection('pulse_play_users').doc(userId);
    await ref.set({
        userId,
        name: userName,
        pulsePoints: FieldValue.increment(points),
        updatedAt: new Date().toISOString(),
    }, { merge: true });
    const snapshot = await ref.get();
    return snapshot.data()?.pulsePoints || 0;
}

export async function getUserPoints(userId) {
    if (!userId) return 0;
    const rtdb = getRealtimeDb();
    if (rtdb) {
        const snapshot = await rtdb.ref(`pulse_play_users/${encodeKey(userId)}/pulsePoints`).get();
        return snapshot.exists() ? snapshot.val() || 0 : 0;
    }
    const db = getDb();
    if (!db) return state.userPoints.get(userId) || 0;
    const snapshot = await db.collection('pulse_play_users').doc(userId).get();
    return snapshot.exists ? snapshot.data().pulsePoints || 0 : 0;
}

function jsonResponse(data, status = 200) {
    return Response.json(data, { status });
}

function oversToBalls(overs) {
    if (overs === null || overs === undefined) return null;
    const whole = Math.trunc(Number(overs));
    const ball = Math.round((Number(overs) - whole) * 10);
    if (ball === 6) return (whole + 1) * 6;
    if (ball < 0 || ball > 5 || Number.isNaN(ball)) return null;
    return whole * 6 + ball;
}

function normalizeRecentDeliveries(recent) {
    if (!recent) return [];
    return String(recent).split(/\s+/).filter(Boolean).slice(-12);
}

function parseNeedRuns(status) {
    const match = String(status || '').match(/\bneed\s+(\d+)\s+runs?\b/i);
    return match ? Number(match[1]) : null;
}

function advantageFromScore({ runsRequired, ballsRemaining, wickets }) {
    if (runsRequired === null || runsRequired === undefined || !ballsRemaining || wickets === null || wickets === undefined) {
        return [null, null];
    }
    const requiredPerBall = runsRequired / ballsRemaining;
    const wicketsFactor = Math.max(10 - wickets, 0) / 10;
    const chase = Math.max(0, Math.min(100, Math.round(52 + (1.45 - requiredPerBall) * 28 + (wicketsFactor - 0.5) * 26)));
    return [chase, 100 - chase];
}

export async function discoverMatches() {
    const now = Date.now();
    if (state.liveMatches.length && now - state.lastDiscoveryAt < 10000) return state.liveMatches;

    const response = await fetch('https://www.cricbuzz.com/', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 10 },
    });
    const html = await response.text();
    const pattern = /title="([^"]+)"\s+href="\/live-cricket-scores\/(\d+)\/([^"]+)"/gi;
    const seen = new Set();
    const matches = [];
    let item;

    while ((item = pattern.exec(html)) !== null) {
        const [, title, matchId, slug] = item;
        if (seen.has(matchId)) continue;
        seen.add(matchId);
        matches.push({
            guid: `cricbuzz-${matchId}`,
            cricbuzzMatchId: matchId,
            title,
            link: `https://www.cricbuzz.com/live-cricket-scores/${matchId}/${slug}`,
            isLive: !/preview|won/i.test(title),
            source: 'Cricbuzz',
        });
    }

    state.liveMatches = matches;
    state.lastDiscoveryAt = now;
    return matches;
}

export async function fetchLiveScore(matchId = DEFAULT_MATCH_ID) {
    const cache = state.matchCache.get(matchId);
    if (cache && Date.now() - cache.cachedAt < 8000) return cache.data;

    const response = await fetch(`https://www.cricbuzz.com/api/mcenter/livescore/${matchId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json',
            Referer: `https://www.cricbuzz.com/live-cricket-scores/${matchId}`,
        },
        cache: 'no-store',
    });
    const payload = await response.json();
    const miniscore = payload.miniscore || {};
    const details = miniscore.matchScoreDetails || {};
    const innings = details.inningsScoreList || [];
    const currentInnings = innings.find((entry) => entry.inningsId === miniscore.inningsId) || innings[0] || {};
    const batTeam = miniscore.batTeam || {};
    const teamInfo = details.matchTeamInfo || [];
    const opponent = teamInfo.find((entry) => entry.battingTeamShortName === currentInnings.batTeamName)?.bowlingTeamShortName || null;
    const runs = batTeam.teamScore ?? currentInnings.score ?? null;
    const wickets = batTeam.teamWkts ?? currentInnings.wickets ?? null;
    const overs = miniscore.overs ?? currentInnings.overs ?? null;
    const ballsBowled = currentInnings.ballNbr ?? oversToBalls(overs);
    const ballsRemaining = ballsBowled === null ? null : Math.max(120 - ballsBowled, 0);
    const target = miniscore.target ?? null;
    const status = miniscore.status || details.customStatus || null;
    const runsRequired = parseNeedRuns(status) ?? (target !== null && runs !== null ? Math.max(target - runs, 0) : null);
    const [chaseAdvantage, defendAdvantage] = advantageFromScore({ runsRequired, ballsRemaining, wickets });
    const title = innings
        .slice()
        .sort((a, b) => a.inningsId - b.inningsId)
        .map((entry) => `${entry.batTeamName} ${entry.score}/${entry.wickets} (${entry.overs})`)
        .join(' v ') || status || `Cricbuzz match ${matchId}`;

    const match = {
        guid: `cricbuzz-${matchId}`,
        cricbuzzMatchId: matchId,
        title,
        link: `https://www.cricbuzz.com/live-cricket-scores/${matchId}`,
        isLive: details.state === 'In Progress',
        source: 'Cricbuzz',
        fetchedAt: new Date().toISOString(),
        battingTeam: currentInnings.batTeamName || null,
        opponent,
        inningsNumber: miniscore.inningsId ?? null,
        inningsCount: innings.length,
        runs,
        wickets,
        wicketsRemaining: wickets === null ? null : Math.max(10 - wickets, 0),
        overs: overs === null ? null : Math.trunc(Number(overs)),
        balls: overs === null ? null : Math.round((Number(overs) - Math.trunc(Number(overs))) * 10),
        oversText: overs === null ? null : String(overs),
        ballsBowled,
        ballsRemaining,
        target,
        runsRequired,
        crr: miniscore.currentRunRate ?? null,
        rrr: miniscore.requiredRunRate ?? null,
        chaseAdvantage,
        defendAdvantage,
        winProbMumbai: chaseAdvantage,
        winProbChennai: defendAdvantage,
        currentStriker: miniscore.batsmanStriker?.batName || null,
        currentNonStriker: miniscore.batsmanNonStriker?.batName || null,
        currentBowler: miniscore.bowlerStriker?.bowlName || null,
        recentDeliveries: normalizeRecentDeliveries(miniscore.recentOvsStats),
        status,
        commentaryList: payload.commentaryList || [],
        rawLastUpdated: miniscore.responseLastUpdated,
        userPoints: 0,
        sentimentAngle: state.sentimentAngle,
    };

    state.matchCache.set(matchId, { data: match, cachedAt: Date.now() });
    return match;
}

export async function selectedMatch() {
    const discovered = await discoverMatches();
    const activeId = state.activeGuid?.startsWith('cricbuzz-') ? state.activeGuid.replace('cricbuzz-', '') : null;
    const firstLive = discovered.find((match) => match.isLive) || discovered[0];
    const matchId = activeId || firstLive?.cricbuzzMatchId || DEFAULT_MATCH_ID;
    const match = await fetchLiveScore(matchId);
    state.activeGuid = match.guid;
    return match;
}

function roundId(match) {
    return `${match.guid}:b${Math.max(Math.floor((match.ballsBowled || 0) / WINDOW_BALLS), 0)}`;
}

function fallbackQuestion(match) {
    const striker = match.currentStriker || match.battingTeam || 'the batting side';
    const bowler = match.currentBowler || 'the bowler';
    const equation = match.runsRequired !== null && match.ballsRemaining !== null
        ? ` with ${match.runsRequired} needed from ${match.ballsRemaining}`
        : '';
    return `What happens in the next ${WINDOW_BALLS} balls as ${striker} faces ${bowler}${equation}?`;
}

async function geminiQuestion(match) {
    if (!process.env.GEMINI_API_KEY) return { question: fallbackQuestion(match), generatedBy: 'Pulse Play' };
    try {
        const prompt = {
            instruction: 'Return strict JSON with one field named question. Write a short cricket prediction question for the next 3 balls. It must fit choices: 0-2 runs, 3-6 runs, 7+ runs, Wicket falls.',
            match: {
                title: match.title,
                status: match.status,
                striker: match.currentStriker,
                bowler: match.currentBowler,
                score: `${match.runs}/${match.wickets}`,
                overs: match.oversText,
                runsRequired: match.runsRequired,
                ballsRemaining: match.ballsRemaining,
                recentDeliveries: match.recentDeliveries,
            },
        };
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: JSON.stringify(prompt) }] }],
                generationConfig: { temperature: 0.85, responseMimeType: 'application/json' },
            }),
        });
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const question = JSON.parse(text || '{}').question;
        return { question: question || fallbackQuestion(match), generatedBy: question ? 'Gemini' : 'Pulse Play' };
    } catch {
        return { question: fallbackQuestion(match), generatedBy: 'Pulse Play' };
    }
}

export async function currentPickRound(match) {
    const id = roundId(match);
    let round = await getRound(id);
    if (!round && !match.isLive) return null;
    if (!round) {
        const { question, generatedBy } = await geminiQuestion(match);
        const startBall = match.ballsBowled || 0;
        round = {
            id,
            matchGuid: match.guid,
            cricbuzzMatchId: match.cricbuzzMatchId,
            bucket: Math.floor(startBall / WINDOW_BALLS),
            question,
            choices: ['0-2 runs', '3-6 runs', '7+ runs', 'Wicket falls'],
            status: 'active',
            ptsReward: REWARD_POINTS,
            generatedBy,
            startBall,
            endBall: startBall + WINDOW_BALLS,
            startRuns: match.runs || 0,
            startWickets: match.wickets || 0,
            inningsNumber: match.inningsNumber ?? null,
            createdAt: new Date().toISOString(),
            expiresAt: Math.floor(Date.now() / 1000) + WINDOW_SECONDS,
            selectedChoice: null,
        };
        await saveRound(round);
    }
    return resolveRound(round, match);
}

export async function pickRounds(match) {
    const rounds = [];
    const current = await currentPickRound(match);
    if (current) rounds.push(current);

    // Resolve and surface the previous window so submissions get awarded
    // and players see the outcome of the round they just played.
    const bucket = Math.max(Math.floor((match.ballsBowled || 0) / WINDOW_BALLS), 0);
    if (bucket > 0) {
        const previousId = `${match.guid}:b${bucket - 1}`;
        const previous = await getRound(previousId);
        if (previous && previous.id !== current?.id) {
            rounds.push(await resolveRound(previous, match));
        }
    }
    return rounds;
}

async function resolveRound(round, match) {
    if (round.status === 'resolved') return round;

    // A window resolves once its balls are actually bowled — not on a wall
    // clock, which fires before real deliveries happen and scores 0 runs.
    // Innings change or end of play resolves it with whatever was observed.
    const ballsDone = (match.ballsBowled || 0) >= round.endBall;
    const inningsChanged = round.inningsNumber !== null
        && match.inningsNumber !== null
        && match.inningsNumber !== round.inningsNumber;
    const playStopped = !match.isLive;
    if (!ballsDone && !inningsChanged && !playStopped) return round;

    const deltaRuns = inningsChanged ? 0 : Math.max((match.runs || 0) - round.startRuns, 0);
    const deltaWickets = inningsChanged ? 0 : Math.max((match.wickets || 0) - round.startWickets, 0);
    const correctChoiceIndex = deltaWickets > 0 ? 3 : deltaRuns <= 2 ? 0 : deltaRuns <= 6 ? 1 : 2;
    const winners = [];

    for (const submission of await listSubmissions(round.id)) {
        if (submission.pickId === round.id && submission.choiceIndex === correctChoiceIndex && !submission.awarded) {
            const points = await awardPoints(submission.userId, submission.userName, REWARD_POINTS);
            submission.awarded = true;
            submission.awardedPoints = REWARD_POINTS;
            submission.userPoints = points;
            await saveSubmission(submission);
            winners.push({ userId: submission.userId, name: submission.userName });
        }
    }

    round.status = 'resolved';
    round.correctChoiceIndex = correctChoiceIndex;
    round.resultText = `${deltaRuns} runs, ${deltaWickets} wickets in the window.`;
    round.resolvedAt = new Date().toISOString();
    round.winners = winners;
    return saveRound(round);
}

export async function submitPick({ pickId, choiceIndex, userId = 'guest', userName = 'Player' }) {
    const match = await selectedMatch();
    const round = await currentPickRound(match);
    if (!round || round.id !== pickId) return { error: 'This round is no longer active', pick: round };
    if (round.status !== 'active' || Date.now() / 1000 >= round.expiresAt) return { error: 'This round is closed', pick: round };

    await saveSubmission({
        pickId,
        matchGuid: match.guid,
        userId,
        userName,
        choiceIndex,
        choiceText: round.choices[choiceIndex],
        submittedAt: new Date().toISOString(),
        awarded: false,
    });
    return { pick: { ...round, selectedChoice: choiceIndex }, reward: round.ptsReward, userPoints: await getUserPoints(userId) };
}

export function buildMoments(match) {
    const moments = (match.commentaryList || []).slice(0, 8).map((item, index) => ({
        id: `${match.guid}-commentary-${index}`,
        over: item.overNumber ?? '--',
        type: (item.event || 'ball').toLowerCase(),
        title: item.batTeamName || 'Live ball',
        description: item.commText,
        rating: 'Live',
        userRated: false,
    }));
    moments.push({
        id: `${match.guid}-score`,
        over: match.oversText || '--',
        type: 'score',
        title: 'Score update',
        description: match.title,
        rating: 'Live',
        userRated: false,
    });
    return moments;
}

export async function getChat(match) {
    const live = [{ user: 'Live Score', text: match.title, tag: 'LIVE' }];
    if (match.runsRequired !== null && match.ballsRemaining !== null) {
        live.push({ user: 'Equation', text: `${match.runsRequired} from ${match.ballsRemaining} balls`, tag: 'LIVE' });
    }
    const rtdb = getRealtimeDb();
    if (rtdb) {
        // Fetch recent messages and filter in memory — avoids requiring an
        // .indexOn rule for matchGuid in the Realtime Database.
        const snapshot = await rtdb.ref('pulse_chat').orderByKey().limitToLast(100).get();
        const messages = snapshot.exists()
            ? Object.values(snapshot.val())
                .filter((item) => !item.matchGuid || item.matchGuid === match.guid)
                .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
                .slice(-25)
            : [];
        return live.concat(messages);
    }
    const db = getDb();
    if (!db) return live.concat(state.chat);
    const snapshot = await db.collection('pulse_chat')
        .where('matchGuid', '==', match.guid)
        .orderBy('createdAt', 'desc')
        .limit(25)
        .get();
    return live.concat(snapshot.docs.map((doc) => doc.data()).reverse());
}

export async function addChat({ text, user = 'You', tag = 'LIVE ROOM', matchGuid = null, userId = 'guest' }) {
    const message = { user, userId, matchGuid, text: String(text || '').trim(), tag, createdAt: new Date().toISOString() };
    if (message.text) {
        const rtdb = getRealtimeDb();
        if (rtdb) {
            await rtdb.ref('pulse_chat').push(cleanForFirestore(message));
            return message;
        }
        const db = getDb();
        if (db) {
            await db.collection('pulse_chat').add(cleanForFirestore(message));
            return message;
        }
        state.chat.push(message);
        if (state.chat.length > 25) state.chat.shift();
    }
    return message;
}

export function setActiveMatch(guid) {
    state.activeGuid = guid;
    return guid;
}

export function triggerCheer() {
    state.sentimentAngle = Math.min(90, state.sentimentAngle + 5);
    return { sentimentAngle: state.sentimentAngle };
}

export function rateMoment({ id, stars }) {
    state.momentRatings.set(id, stars);
    return { id, userRated: true, userStars: stars };
}

export { jsonResponse };
