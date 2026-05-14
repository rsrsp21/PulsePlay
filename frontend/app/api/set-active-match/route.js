import { jsonResponse, setActiveMatch } from '../../../lib/pulseplay.js';

export async function POST(request) {
    const body = await request.json();
    if (!body.guid) return jsonResponse({ error: 'Missing match id' }, 400);
    return jsonResponse({ success: true, activeGuid: setActiveMatch(body.guid) });
}
