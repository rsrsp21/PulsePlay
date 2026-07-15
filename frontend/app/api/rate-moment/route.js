import { getUserPoints, jsonResponse, rateMoment } from '../../../lib/pulseplay.js';
import { verifyUserFromRequest } from '../../../lib/firebaseAdmin.js';

export async function POST(request) {
    const body = await request.json();
    const user = await verifyUserFromRequest(request);
    const rating = rateMoment({ id: body.id, stars: body.stars || 5 });
    return jsonResponse({
        success: true,
        moment: { ...rating, id: body.id },
        userPoints: user ? await getUserPoints(user.uid) : 0,
    });
}
