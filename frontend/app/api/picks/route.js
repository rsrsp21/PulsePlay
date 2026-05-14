import { currentPickRound, getSubmission, jsonResponse, selectedMatch } from '../../../lib/pulseplay.js';
import { verifyUserFromRequest } from '../../../lib/firebaseAdmin.js';

export async function GET(request) {
    const match = await selectedMatch();
    const pick = await currentPickRound(match);
    const user = await verifyUserFromRequest(request);
    const submission = pick && user ? await getSubmission(pick.id, user.uid) : null;
    return jsonResponse({ picks: pick ? [{ ...pick, selectedChoice: submission?.choiceIndex ?? null }] : [] });
}
