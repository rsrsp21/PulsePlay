import { fetchScorecard, jsonResponse, selectedMatch } from '../../../lib/pulseplay.js';

export async function GET() {
    const match = await selectedMatch();
    const card = await fetchScorecard(match.cricbuzzMatchId);
    return jsonResponse(card);
}
