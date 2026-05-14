import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

function serviceAccountFromEnv() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
    }

    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        return {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
    }

    return null;
}

export function getFirebaseAdminApp() {
    if (getApps().length) return getApps()[0];
    const account = serviceAccountFromEnv();
    if (!account) return null;
    return initializeApp({
        credential: cert(account),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
}

export function getDb() {
    const app = getFirebaseAdminApp();
    return app ? getFirestore(app) : null;
}

export function getRealtimeDb() {
    const app = getFirebaseAdminApp();
    return app && process.env.FIREBASE_DATABASE_URL ? getDatabase(app) : null;
}

export async function verifyUserFromRequest(request) {
    const app = getFirebaseAdminApp();
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!app || !token) return null;

    try {
        const decoded = await getAuth(app).verifyIdToken(token);
        return {
            uid: decoded.uid,
            email: decoded.email || '',
            name: decoded.name || decoded.email?.split('@')[0] || 'Player',
        };
    } catch {
        return null;
    }
}

export { FieldValue };
