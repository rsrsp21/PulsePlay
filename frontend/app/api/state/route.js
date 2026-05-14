import { jsonResponse, selectedMatch } from '../../../lib/pulseplay.js';

export async function GET() {
    const match = await selectedMatch();
    const commentary = match.runsRequired !== null && match.ballsRemaining !== null
        ? `${match.title} | Need ${match.runsRequired} from ${match.ballsRemaining} balls`
        : match.status || match.title;
    return jsonResponse({
        matchState: match,
        commentary,
        drsPoll: { yes: 0, no: 0, total: 0 },
    });
}
