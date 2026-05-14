import { discoverMatches, fetchLiveScore, jsonResponse } from '../../../lib/pulseplay.js';

export async function GET() {
    const discovered = await discoverMatches();
    const matches = [];
    for (const item of discovered.slice(0, 6)) {
        if (item.isLive) {
            try {
                matches.push(await fetchLiveScore(item.cricbuzzMatchId));
            } catch {
                matches.push(item);
            }
        } else {
            matches.push(item);
        }
    }
    return jsonResponse({ success: true, matches });
}
