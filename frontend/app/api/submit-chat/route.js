import { addChat, jsonResponse } from '../../../lib/pulseplay.js';
import { verifyUserFromRequest } from '../../../lib/firebaseAdmin.js';

export async function POST(request) {
    const body = await request.json();
    const firebaseUser = await verifyUserFromRequest(request);
    const message = await addChat({
        ...body,
        userId: firebaseUser?.uid || body.userId || 'guest',
        user: firebaseUser?.name || body.user || 'Player',
    });
    if (!message.text) return jsonResponse({ error: 'Message body is empty' }, 400);
    return jsonResponse({ success: true, message, userPoints: 0 });
}
