import { buildMoments, jsonResponse, selectedMatch } from '../../../lib/pulseplay.js';

export async function GET() {
    const match = await selectedMatch();
    return jsonResponse({ moments: buildMoments(match) });
}
