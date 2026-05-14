import { jsonResponse, rateMoment } from '../../../lib/pulseplay.js';

export async function POST(request) {
    const body = await request.json();
    const rating = rateMoment({ id: body.id, stars: body.stars || 5 });
    return jsonResponse({
        success: true,
        moment: { ...rating, id: body.id },
        userPoints: 0,
    });
}
