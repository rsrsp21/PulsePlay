import { jsonResponse, triggerCheer } from '../../../lib/pulseplay.js';

export async function POST() {
    return jsonResponse({ success: true, userPoints: 0, ...triggerCheer() });
}
