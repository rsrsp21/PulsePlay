import { initializeApp, getApps } from 'firebase/app';
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    sendPasswordResetEmail,
} from 'firebase/auth';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

export const isFirebaseConfigured = Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

const app = isFirebaseConfigured ? (getApps()[0] || initializeApp(firebaseConfig)) : null;
export const auth = app ? getAuth(app) : null;

export function listenToPlayer(callback) {
    if (!auth) {
        callback(null);
        return () => {};
    }

    return onAuthStateChanged(auth, async (user) => {
        if (!user) {
            callback(null);
            return;
        }

        callback({
            id: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'Player',
            email: user.email || '',
            initials: (user.displayName || user.email || 'P').slice(0, 1).toUpperCase(),
            getIdToken: () => user.getIdToken(),
        });
    });
}

export async function loginWithEmail({ email, password }) {
    if (!auth) throw new Error('Firebase is not configured.');
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
}

export async function signupWithEmail({ name, email, password }) {
    if (!auth) throw new Error('Firebase is not configured.');
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
        await updateProfile(credential.user, { displayName: name });
    }
    return credential.user;
}

export async function logoutPlayer() {
    if (auth) await signOut(auth);
}

export async function resetPassword(email) {
    if (!auth) throw new Error('Firebase is not configured.');
    await sendPasswordResetEmail(auth, email);
}
