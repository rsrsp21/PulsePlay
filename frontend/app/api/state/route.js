import { getUserPoints, jsonResponse, selectedMatch } from '../../../lib/pulseplay.js';
import { verifyUserFromRequest } from '../../../lib/firebaseAdmin.js';

export async function GET(request) {
    const preferred = new URL(request.url).searchParams.get('match');
    const match = await selectedMatch(preferred);
    const user = await verifyUserFromRequest(request);
    const userPoints = user ? await getUserPoints(user.uid) : 0;
    const commentary = match.runsRequired !== null && match.ballsRemaining !== null
        ? `${match.title} | Need ${match.runsRequired} from ${match.ballsRemaining} balls`
        : match.status || match.title;
    return jsonResponse({
        matchState: { ...match, userPoints },
        commentary,
        drsPoll: { yes: 0, no: 0, total: 0 },
    });
}
