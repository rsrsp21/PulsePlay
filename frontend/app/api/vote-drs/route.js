import { jsonResponse } from '../../../lib/pulseplay.js';

export async function POST() {
    return jsonResponse({ success: true, drsPoll: { yes: 0, no: 0, total: 0 }, userPoints: 0 });
}
