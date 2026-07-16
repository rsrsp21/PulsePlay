import { FieldValue, getDb, getRealtimeDb } from './firebaseAdmin.js';

const DEFAULT_MATCH_ID = process.env.CRICBUZZ_MATCH_ID || '152141';
const WINDOW_SECONDS = Number(process.env.PULSE_PICK_WINDOW_SECONDS || 45);
const REWARD_POINTS = Number(process.env.PULSE_PICK_REWARD_POINTS || 50);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Balls remaining in the chase, derived from live data rather than a
// hardcoded innings length: prefer an explicit "in N balls" in the status,
// otherwise back it out of Cricbuzz's own required run rate.
function parseNeedBalls(status) {
    const found = String(status || '').match(/in\s+(\d+)\s+balls?\b/i);
    return found ? Number(found[1]) : null;
}

function deriveBallsRemaining({ status, runsRequired, requiredRunRate }) {
    const fromStatus = parseNeedBalls(status);
    if (fromStatus !== null) return fromStatus;
    const rrr = Number(requiredRunRate);
    if (runsRequired !== null && runsRequired !== undefined && rrr > 0) {
        return Math.max(0, Math.round((runsRequired / rrr) * 6));
    }
    return null;
}

// A match counts as live for gameplay unless it's finished or hasn't started.
// Transient in-play breaks (drinks, over/innings breaks, rain) stay live so
// the current pick round doesn't force-resolve mid-match.
function isMatchLive(matchState, status) {
    const s = String(matchState || '').toLowerCase();
    const notLive = ['complete', 'stumps', 'abandon', 'cancel', 'no result', 'preview', 'toss', 'upcoming', 'scheduled'];
    if (s) return !notLive.some((word) => s.includes(word));
    return !/won|abandon|no result|preview|stumps|complete/i.test(String(status || ''));
}

// How many balls a round watches before it can be judged. The AI proposes
// this per question; we clamp it so questions span a few balls (not every
// ball) but still turn over quickly — max 12 balls (two overs) so the next
// question never feels far away.
const MIN_HORIZON_BALLS = 3;
const MAX_HORIZON_BALLS = 12;

function clampHorizon(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return 6;
    return Math.max(MIN_HORIZON_BALLS, Math.min(MAX_HORIZON_BALLS, n));
}

// The submit lock scales with the window so longer questions stay open
// longer (a fixed 45s would close before a multi-over question is decided).
const SECONDS_PER_BALL = 30;

function submitWindowSeconds(horizonBalls) {
    return Math.max(WINDOW_SECONDS, Math.round(horizonBalls * SECONDS_PER_BALL * 0.5));
}

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
    activeRoundByGuid: new Map(),
    lastResolvedByGuid: new Map(),
    creatingRound: new Set(),
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

// Cricbuzz reports a completed over as e.g. "19.6"; cricket convention rolls
// that to "20.0". Derive the display from the true ball count so it's correct.
function formatOvers(balls) {
    if (balls === null || balls === undefined) return null;
    return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function oversDisplayFrom(overs, ballNbr) {
    const balls = ballNbr ?? oversToBalls(overs);
    if (balls !== null && balls !== undefined) return formatOvers(balls);
    return overs === null || overs === undefined ? null : String(overs);
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

function getMockMatchScore(matchId) {
    const title = "India v Pakistan (Live Offline Demo)";
    return {
        guid: `cricbuzz-${matchId}`,
        cricbuzzMatchId: matchId,
        title,
        link: `https://www.cricbuzz.com/live-cricket-scores/${matchId}`,
        isLive: true,
        source: 'Pulse Play Fallback',
        fetchedAt: new Date().toISOString(),
        battingTeam: "India",
        opponent: "Pakistan",
        inningsNumber: 2,
        inningsCount: 2,
        runs: 152,
        wickets: 4,
        wicketsRemaining: 6,
        overs: 15,
        balls: 2,
        oversText: "15.2",
        ballsBowled: 92,
        ballsRemaining: 28,
        target: 180,
        runsRequired: 28,
        crr: "9.91",
        rrr: "6.00",
        chaseAdvantage: 65,
        defendAdvantage: 35,
        winProbMumbai: 65,
        winProbChennai: 35,
        currentStriker: "Hardik Pandya",
        currentNonStriker: "Ravindra Jadeja",
        currentBowler: "Shaheen Afridi",
        striker: { name: "Hardik Pandya", runs: 34, balls: 19, fours: 2, sixes: 2, strikeRate: 179 },
        nonStriker: { name: "Ravindra Jadeja", runs: 21, balls: 15, fours: 1, sixes: 1, strikeRate: 140 },
        bowler: { name: "Shaheen Afridi", overs: 3, runs: 32, wickets: 1, economy: 10.7, maidens: 0 },
        partnership: { runs: 41, balls: 24 },
        lastWicket: "Suryakumar Yadav c Rizwan b Rauf 38(22) - 111/4 in 12.5 ov.",
        recentDeliveries: ["1", "4", "W", "2", "6", "1"],
        status: "India need 28 runs in 28 balls",
        commentaryList: [
            { overNumber: "15.2", event: "Ball", commText: "Shaheen Afridi to Hardik Pandya, 1 run, guided towards third man." },
            { overNumber: "15.1", event: "Six", commText: "Shaheen Afridi to Hardik Pandya, SIX, smashed over long-on!" }
        ],
        rawLastUpdated: Date.now(),
        userPoints: 0,
        sentimentAngle: state.sentimentAngle,
    };
}

export async function discoverMatches() {
    const now = Date.now();
    if (state.liveMatches.length && now - state.lastDiscoveryAt < 10000) return state.liveMatches;

    try {
        const response = await fetch('https://www.cricbuzz.com/', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 10 },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
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

        if (matches.length > 0) {
            state.liveMatches = matches;
            state.lastDiscoveryAt = now;
            return matches;
        }
    } catch (err) {
        console.error("Failed to discover matches from Cricbuzz:", err);
    }

    if (!state.liveMatches.length) {
        state.liveMatches = [{
            guid: `cricbuzz-${DEFAULT_MATCH_ID}`,
            cricbuzzMatchId: DEFAULT_MATCH_ID,
            title: "India v Pakistan (Live Offline Demo)",
            link: `https://www.cricbuzz.com/live-cricket-scores/${DEFAULT_MATCH_ID}`,
            isLive: true,
            source: 'Pulse Play Fallback',
        }];
    }
    return state.liveMatches;
}

export async function fetchLiveScore(matchId = DEFAULT_MATCH_ID) {
    const cache = state.matchCache.get(matchId);
    if (cache && Date.now() - cache.cachedAt < 8000) return cache.data;

    try {
        const response = await fetch(`https://www.cricbuzz.com/api/mcenter/livescore/${matchId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: 'application/json',
                Referer: `https://www.cricbuzz.com/live-cricket-scores/${matchId}`,
            },
            cache: 'no-store',
        });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
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
        const target = miniscore.target ?? null;
        const status = miniscore.status || details.customStatus || null;
        const runsRequired = parseNeedRuns(status)
            ?? (miniscore.remRunsToWin ?? null)
            ?? (target !== null && runs !== null ? Math.max(target - runs, 0) : null);
        const requiredRunRate = miniscore.requiredRunRate ?? null;
        const ballsRemaining = deriveBallsRemaining({ status, runsRequired, requiredRunRate });
        const [chaseAdvantage, defendAdvantage] = advantageFromScore({ runsRequired, ballsRemaining, wickets });

        const batToStat = (b) => (b && b.batName ? {
            name: b.batName,
            runs: b.batRuns ?? null,
            balls: b.batBalls ?? null,
            fours: b.batFours ?? null,
            sixes: b.batSixes ?? null,
            strikeRate: b.batStrikeRate ? Math.round(b.batStrikeRate) : null,
        } : null);
        const bowlToStat = (b) => (b && b.bowlName ? {
            name: b.bowlName,
            overs: b.bowlOvs ?? null,
            runs: b.bowlRuns ?? null,
            wickets: b.bowlWkts ?? null,
            economy: b.bowlEcon ?? null,
            maidens: b.bowlMaidens ?? null,
        } : null);
        const striker = batToStat(miniscore.batsmanStriker);
        const nonStriker = batToStat(miniscore.batsmanNonStriker);
        const bowler = bowlToStat(miniscore.bowlerStriker);
        const partnership = miniscore.partnerShip
            ? { runs: miniscore.partnerShip.runs ?? null, balls: miniscore.partnerShip.balls ?? null }
            : null;
        const lastWicket = miniscore.lastWicket || null;

        const title = innings
            .slice()
            .sort((a, b) => a.inningsId - b.inningsId)
            .map((entry) => `${entry.batTeamName} ${entry.score}/${entry.wickets} (${oversDisplayFrom(entry.overs, entry.ballNbr)})`)
            .join(' v ') || status || `Cricbuzz match ${matchId}`;

        const match = {
            guid: `cricbuzz-${matchId}`,
            cricbuzzMatchId: matchId,
            title,
            link: `https://www.cricbuzz.com/live-cricket-scores/${matchId}`,
            isLive: isMatchLive(details.state, status),
            source: 'Cricbuzz',
            fetchedAt: new Date().toISOString(),
            battingTeam: currentInnings.batTeamName || null,
            opponent,
            matchFormat: details.matchFormat || null,
            inningsNumber: miniscore.inningsId ?? null,
            inningsCount: innings.length,
            runs,
            wickets,
            wicketsRemaining: wickets === null ? null : Math.max(10 - wickets, 0),
            overs: ballsBowled === null ? null : Math.floor(ballsBowled / 6),
            balls: ballsBowled === null ? null : ballsBowled % 6,
            oversText: oversDisplayFrom(overs, ballsBowled),
            ballsBowled,
            ballsRemaining,
            target,
            runsRequired,
            crr: miniscore.currentRunRate ?? null,
            rrr: requiredRunRate,
            chaseAdvantage,
            defendAdvantage,
            winProbMumbai: chaseAdvantage,
            winProbChennai: defendAdvantage,
            currentStriker: striker?.name || null,
            currentNonStriker: nonStriker?.name || null,
            currentBowler: bowler?.name || null,
            striker,
            nonStriker,
            bowler,
            partnership,
            lastWicket,
            recentDeliveries: normalizeRecentDeliveries(miniscore.recentOvsStats),
            status,
            commentaryList: payload.commentaryList || [],
            rawLastUpdated: miniscore.responseLastUpdated,
            userPoints: 0,
            sentimentAngle: state.sentimentAngle,
        };

        state.matchCache.set(matchId, { data: match, cachedAt: Date.now() });
        return match;
    } catch (err) {
        console.error("Failed to fetch live score from Cricbuzz:", err);
        if (cache) {
            console.log("Using cached match data");
            return cache.data;
        }
        return getMockMatchScore(matchId);
    }
}

export async function fetchScorecard(matchId = DEFAULT_MATCH_ID) {
    const cacheKey = `scard-${matchId}`;
    const cache = state.matchCache.get(cacheKey);
    if (cache && Date.now() - cache.cachedAt < 8000) return cache.data;

    try {
        const response = await fetch(`https://www.cricbuzz.com/api/mcenter/scorecard/${matchId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: 'application/json',
                Referer: `https://www.cricbuzz.com/live-cricket-scorecard/${matchId}`,
            },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const payload = await response.json();

        const innings = (payload.scoreCard || []).map((inn) => {
            const bat = inn.batTeamDetails || {};
            const bowl = inn.bowlTeamDetails || {};
            const sd = inn.scoreDetails || {};
            const extras = inn.extrasData || {};
            return {
                inningsId: inn.inningsId,
                battingTeam: bat.batTeamName || bat.batTeamShortName || 'Innings',
                bowlingTeam: bowl.bowlTeamName || bowl.bowlTeamShortName || null,
                runs: sd.runs ?? null,
                wickets: sd.wickets ?? null,
                overs: oversDisplayFrom(sd.overs, sd.ballNbr),
                runRate: sd.runRate ?? null,
                extras: extras.total ?? null,
                batsmen: Object.values(bat.batsmenData || {}).map((b) => ({
                    name: b.batName,
                    runs: b.runs ?? 0,
                    balls: b.balls ?? 0,
                    fours: b.fours ?? 0,
                    sixes: b.sixes ?? 0,
                    strikeRate: b.strikeRate ? Math.round(b.strikeRate) : 0,
                    outDesc: b.outDesc || 'not out',
                    notOut: /^batting$|not out/i.test(b.outDesc || ''),
                })),
                bowlers: Object.values(bowl.bowlersData || {}).map((b) => ({
                    name: b.bowlName,
                    overs: b.overs ?? 0,
                    maidens: b.maidens ?? 0,
                    runs: b.runs ?? 0,
                    wickets: b.wickets ?? 0,
                    economy: b.economy ?? null,
                })),
            };
        }).sort((a, b) => b.inningsId - a.inningsId);

        const data = { matchId, innings, isComplete: Boolean(payload.isMatchComplete) };
        state.matchCache.set(cacheKey, { data, cachedAt: Date.now() });
        return data;
    } catch (err) {
        console.error('Failed to fetch scorecard from Cricbuzz:', err);
        if (cache) return cache.data;
        return { matchId, innings: [], isComplete: false };
    }
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


// ---- Active-round pointers (RTDB-backed, in-memory fallback) ----------------

async function getPointer(path, guid, memMap) {
    const rtdb = getRealtimeDb();
    if (rtdb) {
        const snap = await rtdb.ref(`${path}/${encodeKey(guid)}`).get();
        return snap.exists() ? snap.val() : null;
    }
    return memMap.get(guid) || null;
}

async function setPointer(path, guid, id, memMap) {
    memMap.set(guid, id);
    const rtdb = getRealtimeDb();
    if (rtdb) await rtdb.ref(`${path}/${encodeKey(guid)}`).set(id);
}

const getActiveRoundId = (guid) => getPointer('pulse_active_round', guid, state.activeRoundByGuid);
const setActiveRoundId = (guid, id) => setPointer('pulse_active_round', guid, id, state.activeRoundByGuid);
const getLastResolvedId = (guid) => getPointer('pulse_last_resolved', guid, state.lastResolvedByGuid);
const setLastResolvedId = (guid, id) => setPointer('pulse_last_resolved', guid, id, state.lastResolvedByGuid);

// ---- Gemini-driven question generation & judging ----------------------------

async function callGemini(promptObj, temperature) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: JSON.stringify(promptObj) }] }],
            generationConfig: { temperature, responseMimeType: 'application/json' },
        }),
    });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(text || '{}');
}

// Compact live scorecard the AI reasons over to invent a question.
function matchContext(match) {
    return {
        title: match.title,
        format: match.matchFormat,
        status: match.status,
        innings: match.inningsNumber,
        battingTeam: match.battingTeam,
        bowlingTeam: match.opponent,
        score: `${match.runs ?? '-'}/${match.wickets ?? '-'}`,
        overs: match.oversText,
        target: match.target,
        runsRequired: match.runsRequired,
        ballsRemaining: match.ballsRemaining,
        currentRunRate: match.crr,
        requiredRunRate: match.rrr,
        striker: match.striker,
        nonStriker: match.nonStriker,
        bowler: match.bowler,
        partnership: match.partnership,
        lastWicket: match.lastWicket,
        recentDeliveries: match.recentDeliveries,
    };
}

// No-Gemini fallback: a couple of self-resolvable templated questions,
// varied by the ball count so it isn't always the same prompt.
function fallbackPick(match) {
    const striker = match.currentStriker || match.battingTeam || 'the batter';
    const bowler = match.currentBowler || 'the bowler';
    const options = [
        { question: `How many runs off the next 3 balls as ${striker} faces ${bowler}?`, choices: ['0-2 runs', '3-5 runs', '6+ runs', 'Wicket falls'], resolveAfterBalls: 3 },
        { question: `How many runs off the next over from ${bowler}?`, choices: ['0-4 runs', '5-8 runs', '9-12 runs', '13+ runs'], resolveAfterBalls: 6 },
        { question: `Will ${striker}'s side lose a wicket in the next 2 overs?`, choices: ['Yes, wicket falls', 'No, they hold on'], resolveAfterBalls: 12 },
    ];
    const pick = options[(match.ballsBowled || 0) % options.length];
    return { ...pick, generatedBy: 'Pulse Play' };
}

async function generateQuestion(match) {
    if (!GEMINI_KEY) return fallbackPick(match);
    try {
        const out = await callGemini({
            role: 'You are the host of a live cricket second-screen prediction game.',
            instruction: 'From the live match situation, invent ONE fun, specific prediction with 2 to 4 mutually-exclusive choices, then set resolveAfterBalls (how many balls until it is decided). VARY the question type across these kinds so it never feels repetitive: runs in the next over, runs off the next 3 balls, whether a wicket falls in the window, whether there is a boundary/six, whether a batter reaches a milestone (fifty/hundred), the partnership passing a number, how the over ends. Use windows of 3 to 12 balls (half an over to two overs), NOT single balls. Use the actual player names, scores and match situation. It must be OBJECTIVELY settled by ball-by-ball play. Return STRICT JSON: {"question": string, "choices": string[], "resolveAfterBalls": integer between 3 and 12}.',
            situation: matchContext(match),
        }, 1.0);
        const question = typeof out.question === 'string' ? out.question.trim() : '';
        const choices = Array.isArray(out.choices)
            ? out.choices.map((c) => String(c).trim()).filter(Boolean).slice(0, 4)
            : [];
        if (!question || choices.length < 2) return fallbackPick(match);
        return { question, choices, resolveAfterBalls: clampHorizon(out.resolveAfterBalls), generatedBy: 'Gemini' };
    } catch {
        return fallbackPick(match);
    }
}

// AI umpire: pick the winning choice from the factual window outcome, or -1.
async function aiJudge(round, facts) {
    try {
        const out = await callGemini({
            role: 'You are a neutral umpire settling a cricket prediction from facts.',
            instruction: 'Given the question, its numbered choices, and the factual outcome of the watched window, return STRICT JSON {"winningIndex": integer}. winningIndex is the 0-based index of the choice that came true. If the facts cannot clearly settle it, return {"winningIndex": -1}.',
            question: round.question,
            choices: round.choices.map((text, index) => ({ index, text })),
            outcome: facts,
        }, 0);
        const idx = Number(out.winningIndex);
        if (Number.isInteger(idx) && idx >= -1 && idx < round.choices.length) return idx;
        return null;
    } catch {
        return null;
    }
}

// Last-resort resolver when Gemini is unavailable: keyword/number matching.
function heuristicJudge(choices, facts) {
    const lc = choices.map((c) => String(c).toLowerCase());
    const findBy = (re) => lc.findIndex((c) => re.test(c));
    const runs = facts.runsScored;

    if (facts.wicketsFell > 0) {
        const yes = findBy(/\byes\b|wicket|out\b|bowled|caught|falls/);
        if (yes >= 0) return yes;
    } else {
        const no = findBy(/\bno\b|hold|survive|safe/);
        if (no >= 0 && lc.some((c) => /yes|wicket/.test(c))) return no;
    }
    if (runs >= 4) { const i = findBy(/boundary|four|six|\b4\b|\b6\b/); if (i >= 0) return i; }
    if (runs === 0) { const i = findBy(/dot|no run|\b0\b/); if (i >= 0) return i; }
    for (let i = 0; i < lc.length; i += 1) {
        const range = lc[i].match(/(\d+)\s*-\s*(\d+)/);
        if (range && runs >= +range[1] && runs <= +range[2]) return i;
        const plus = lc[i].match(/(\d+)\s*\+/);
        if (plus && runs >= +plus[1]) return i;
    }
    return -1;
}

async function judgeRound(round, facts) {
    if (GEMINI_KEY) {
        const idx = await aiJudge(round, facts);
        if (idx !== null) return idx;
    }
    return heuristicJudge(round.choices, facts);
}

// ---- Round lifecycle --------------------------------------------------------

function snapshotOf(match) {
    return {
        runs: match.runs ?? 0,
        wickets: match.wickets ?? 0,
        ballsBowled: match.ballsBowled ?? 0,
        striker: match.striker || null,
        nonStriker: match.nonStriker || null,
        bowler: match.bowler || null,
    };
}

async function createRound(match) {
    const { question, choices, resolveAfterBalls, generatedBy } = await generateQuestion(match);
    const startBall = match.ballsBowled || 0;
    const round = {
        id: `${match.guid}:b${startBall}-${Math.random().toString(36).slice(2, 7)}`,
        matchGuid: match.guid,
        cricbuzzMatchId: match.cricbuzzMatchId,
        question,
        choices,
        status: 'active',
        ptsReward: REWARD_POINTS,
        generatedBy,
        horizonBalls: resolveAfterBalls,
        startBall,
        endBall: startBall + resolveAfterBalls,
        inningsNumber: match.inningsNumber ?? null,
        snapshot: snapshotOf(match),
        createdAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + submitWindowSeconds(resolveAfterBalls),
        selectedChoice: null,
    };
    await saveRound(round);
    return round;
}

export async function currentPickRound(match) {
    const guid = match.guid;
    const activeId = await getActiveRoundId(guid);
    let round = activeId ? await getRound(activeId) : null;

    if (round) {
        round = round.status === 'resolved' ? round : await resolveRound(round, match);
        if (round.status === 'resolved') {
            await setLastResolvedId(guid, round.id);
            round = null; // its window closed — a fresh question opens below
        }
    }

    if (!round) {
        if (!match.isLive) return null;
        // Guard against two concurrent polls both creating a round.
        if (state.creatingRound.has(guid)) {
            const retryId = await getActiveRoundId(guid);
            return retryId ? await getRound(retryId) : null;
        }
        state.creatingRound.add(guid);
        try {
            const created = await createRound(match);
            await setActiveRoundId(guid, created.id);
            return created;
        } finally {
            state.creatingRound.delete(guid);
        }
    }
    return round;
}

export async function pickRounds(match) {
    const rounds = [];
    const current = await currentPickRound(match);
    if (current) rounds.push(current);

    // Surface the most recently resolved round so players see its outcome.
    const lastId = await getLastResolvedId(match.guid);
    if (lastId && lastId !== current?.id) {
        const previous = await getRound(lastId);
        if (previous) rounds.push(previous);
    }
    return rounds;
}

function buildResultText(round, facts, idx) {
    if (facts.interrupted) return 'Round voided — play was interrupted.';
    const balls = facts.ballsElapsed;
    const outcome = `${facts.runsScored} run${facts.runsScored === 1 ? '' : 's'}`
        + (facts.wicketsFell ? `, ${facts.wicketsFell} wkt` : '')
        + ` off ${balls} ball${balls === 1 ? '' : 's'}`;
    if (idx < 0 || !round.choices[idx]) return `${outcome} · no clear winner.`;
    return `${outcome} · answer: ${round.choices[idx]}.`;
}

async function resolveRound(round, match) {
    if (round.status === 'resolved') return round;

    const snap = round.snapshot || { runs: round.startRuns || 0, wickets: round.startWickets || 0, ballsBowled: round.startBall || 0 };
    const endBall = round.endBall ?? ((round.startBall || 0) + 1);
    const ballsDone = (match.ballsBowled ?? 0) >= endBall;
    const inningsChanged = round.inningsNumber != null
        && match.inningsNumber != null
        && match.inningsNumber !== round.inningsNumber;
    const playStopped = !match.isLive;
    if (!ballsDone && !inningsChanged && !playStopped) return round;

    const facts = {
        runsScored: Math.max((match.runs ?? 0) - (snap.runs ?? 0), 0),
        wicketsFell: Math.max((match.wickets ?? 0) - (snap.wickets ?? 0), 0),
        ballsElapsed: Math.max((match.ballsBowled ?? 0) - (snap.ballsBowled ?? 0), 0),
        strikerThen: snap.striker,
        strikerNow: match.striker,
        nonStrikerNow: match.nonStriker,
        recentDeliveries: match.recentDeliveries,
        // Interrupted before the window completed → can't be judged fairly.
        interrupted: inningsChanged || (playStopped && !ballsDone),
    };

    const correctChoiceIndex = facts.interrupted ? -1 : await judgeRound(round, facts);
    const winners = [];
    if (correctChoiceIndex >= 0) {
        for (const submission of await listSubmissions(round.id)) {
            if (submission.choiceIndex === correctChoiceIndex && !submission.awarded) {
                const points = await awardPoints(submission.userId, submission.userName, REWARD_POINTS);
                submission.awarded = true;
                submission.awardedPoints = REWARD_POINTS;
                submission.userPoints = points;
                await saveSubmission(submission);
                winners.push({ userId: submission.userId, name: submission.userName });
            }
        }
    }

    round.status = 'resolved';
    round.correctChoiceIndex = correctChoiceIndex;
    round.resultText = buildResultText(round, facts, correctChoiceIndex);
    round.resolvedAt = new Date().toISOString();
    round.winners = winners;
    return saveRound(round);
}

export async function submitPick({ pickId, choiceIndex, userId = 'guest', userName = 'Player' }) {
    const match = await selectedMatch();
    const round = await currentPickRound(match);
    if (!round || round.id !== pickId) return { error: 'This round is no longer active', pick: round };
    if (round.status !== 'active' || Date.now() / 1000 >= round.expiresAt) return { error: 'This round is closed', pick: round };
    if (choiceIndex < 0 || choiceIndex >= round.choices.length) return { error: 'Invalid choice', pick: round };

    await saveSubmission({
        submissionId: `${pickId}:${userId}`,   // unique row id (pick + user)
        pickId,                                 // the pick / round id
        questionId: round.id,                   // question id (same round)
        question: round.question,               // question text, for the record
        matchGuid: match.guid,                  // match id
        cricbuzzMatchId: match.cricbuzzMatchId,
        userId,                                 // who answered
        userName,
        choiceIndex,                            // user's answer (index)
        choiceText: round.choices[choiceIndex], // user's answer (text)
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
        const snapshot = await rtdb.ref('pulse_chat').orderByKey().limitToLast(200).get();
        const messages = snapshot.exists()
            ? Object.values(snapshot.val())
                .filter((item) => item.matchGuid === match.guid)
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
