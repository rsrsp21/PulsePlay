import { getUserPoints, jsonResponse, triggerCheer } from '../../../lib/pulseplay.js';
import { verifyUserFromRequest } from '../../../lib/firebaseAdmin.js';

export async function POST(request) {
    const user = await verifyUserFromRequest(request);
    return jsonResponse({
        success: true,
        userPoints: user ? await getUserPoints(user.uid) : 0,
        ...triggerCheer(),
    });
}
