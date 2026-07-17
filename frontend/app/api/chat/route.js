import { getChat, jsonResponse, selectedMatch } from '../../../lib/pulseplay.js';

export async function GET(request) {
    const preferred = new URL(request.url).searchParams.get('match');
    const match = await selectedMatch(preferred);
    return jsonResponse({ chat: await getChat(match) });
}
