import { getSubmission, jsonResponse, pickRounds, selectedMatch } from '../../../lib/pulseplay.js';
import { verifyUserFromRequest } from '../../../lib/firebaseAdmin.js';

export async function GET(request) {
    const preferred = new URL(request.url).searchParams.get('match');
    const match = await selectedMatch(preferred);
    const rounds = await pickRounds(match);
    const user = await verifyUserFromRequest(request);
    const picks = await Promise.all(rounds.map(async (round) => {
        const submission = user ? await getSubmission(round.id, user.uid) : null;
        return { ...round, selectedChoice: submission?.choiceIndex ?? null };
    }));
    return jsonResponse({ picks });
}
