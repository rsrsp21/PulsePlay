import { getChat, jsonResponse, selectedMatch } from '../../../lib/pulseplay.js';

export async function GET() {
    const match = await selectedMatch();
    return jsonResponse({ chat: await getChat(match) });
}
