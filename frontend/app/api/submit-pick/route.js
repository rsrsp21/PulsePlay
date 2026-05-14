import { jsonResponse, submitPick } from '../../../lib/pulseplay.js';
import { verifyUserFromRequest } from '../../../lib/firebaseAdmin.js';

export async function POST(request) {
    const body = await request.json();
    const firebaseUser = await verifyUserFromRequest(request);
    const result = await submitPick({
        ...body,
        userId: firebaseUser?.uid || body.userId,
        userName: firebaseUser?.name || body.userName,
    });
    if (result.error) return jsonResponse(result, 400);
    return jsonResponse({ success: true, ...result });
}
