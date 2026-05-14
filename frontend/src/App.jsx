'use client';

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DashboardTab from './components/DashboardTab';
import TimelineTab from './components/TimelineTab';
import PicksTab from './components/PicksTab';
import FanZoneTab from './components/FanZoneTab';
import TacticalTab from './components/TacticalTab';
import {
    isFirebaseConfigured,
    listenToPlayer,
    loginWithEmail,
    logoutPlayer,
    signupWithEmail,
} from './firebaseClient';

const API_BASE = '/api';

function AuthPanel({ mode, onModeChange, onSubmit, onClose }) {
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [error, setError] = useState('');
    const isSignup = mode === 'signup';

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        try {
            await onSubmit({
                name: form.name.trim(),
                email: form.email.trim(),
                password: form.password,
            });
        } catch (err) {
            setError(err.message || 'Could not sign in. Please try again.');
        }
    };

    return (
        <div className="auth-backdrop">
            <form className="auth-card glass-panel" onSubmit={handleSubmit}>
                <button type="button" className="icon-button auth-close" onClick={onClose} aria-label="Close">
                    <i className="fa-solid fa-xmark"></i>
                </button>
                <div className="brand-mark large">
                    <span>P</span>
                </div>
                <h2>{isSignup ? 'Create your Pulse Play account' : 'Welcome back to Pulse Play'}</h2>
                <p>Join the live room, lock predictions, post reactions, and climb the match leaderboard.</p>
                {!isFirebaseConfigured && (
                    <p className="auth-error">Firebase is not configured yet. Add your Firebase web env vars in Vercel.</p>
                )}

                {isSignup && (
                    <label className="field-label">
                        Display name
                        <input
                            value={form.name}
                            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder="Rohit Fan"
                        />
                    </label>
                )}

                <label className="field-label">
                    Email
                    <input
                        type="email"
                        value={form.email}
                        onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                        placeholder="you@example.com"
                    />
                </label>

                <label className="field-label">
                    Password
                    <input
                        type="password"
                        value={form.password}
                        onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                        placeholder="Minimum 6 characters"
                        minLength={6}
                    />
                </label>

                {error && <p className="auth-error">{error}</p>}

                <button className="primary-action" type="submit">
                    {isSignup ? 'Start playing' : 'Enter live room'}
                </button>

                <button
                    className="text-action"
                    type="button"
                    onClick={() => onModeChange(isSignup ? 'login' : 'signup')}
                >
                    {isSignup ? 'Already have an account? Log in' : 'New here? Sign up'}
                </button>
            </form>
        </div>
    );
}

export default function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [liveMatches, setLiveMatches] = useState([]);
    const [activeGuid, setActiveGuid] = useState(null);
    const [matchState, setMatchState] = useState(null);
    const [commentary, setCommentary] = useState('');
    const [moments, setMoments] = useState([]);
    const [picks, setPicks] = useState([]);
    const [chat, setChat] = useState([]);
    const [selectedModalMoment, setSelectedModalMoment] = useState(null);
    const [authMode, setAuthMode] = useState('signup');
    const [showAuth, setShowAuth] = useState(false);
    const [player, setPlayer] = useState(null);

    useEffect(() => listenToPlayer(setPlayer), []);

    const authedFetch = async (url, options = {}) => {
        const token = player?.getIdToken ? await player.getIdToken() : null;
        return fetch(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });
    };

    const fetchLiveMatches = async () => {
        try {
            const res = await fetch(`${API_BASE}/live-matches`);
            if (res.ok) {
                const data = await res.json();
                setLiveMatches(data.matches || []);
            }
        } catch (err) {}
    };

    const fetchCoreState = async () => {
        try {
            const res = await fetch(`${API_BASE}/state`);
            if (res.ok) {
                const data = await res.json();
                setMatchState(data.matchState);
                setActiveGuid(data.matchState?.guid);
                setCommentary(data.commentary);
            }
        } catch (err) {}
    };

    const fetchSecondaryLists = async () => {
        try {
            fetch(`${API_BASE}/moments`).then(r => r.json()).then(d => setMoments(d.moments || [])).catch(() => {});
            authedFetch(`${API_BASE}/picks`).then(r => r.json()).then(d => setPicks(d.picks || [])).catch(() => {});
            authedFetch(`${API_BASE}/chat`).then(r => r.json()).then(d => setChat(d.chat || [])).catch(() => {});
        } catch (err) {}
    };

    useEffect(() => {
        fetchLiveMatches();
        fetchCoreState();
        fetchSecondaryLists();

        const matchesInterval = setInterval(fetchLiveMatches, 10000);
        const stateInterval = setInterval(fetchCoreState, 2000);
        const listsInterval = setInterval(fetchSecondaryLists, 4000);

        return () => {
            clearInterval(matchesInterval);
            clearInterval(stateInterval);
            clearInterval(listsInterval);
        };
    }, [player?.id]);

    const completeAuth = async (account) => {
        if (!isFirebaseConfigured) {
            throw new Error('Firebase is not configured yet.');
        }
        if (authMode === 'signup') {
            await signupWithEmail(account);
        } else {
            await loginWithEmail(account);
        }
        setShowAuth(false);
    };

    const requirePlayer = () => {
        if (player) return true;
        setAuthMode('signup');
        setShowAuth(true);
        return false;
    };

    const handleSwitchMatch = async (guid) => {
        try {
            const res = await fetch(`${API_BASE}/set-active-match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guid })
            });
            if (res.ok) {
                const data = await res.json();
                setActiveGuid(data.activeGuid);
                fetchCoreState();
                fetchSecondaryLists();
            }
        } catch (err) {}
    };

    const handleCheerTrigger = async () => {
        if (!requirePlayer()) return;
        try {
            const res = await authedFetch(`${API_BASE}/trigger-boundary-cheer`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setMatchState(prev => prev ? { ...prev, userPoints: data.userPoints, sentimentAngle: data.sentimentAngle } : null);
            }
        } catch (err) {}
    };

    const handleSubmitPick = async (pickId, choiceIdx) => {
        if (!requirePlayer()) return;
        try {
            const res = await authedFetch(`${API_BASE}/submit-pick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pickId,
                    choiceIndex: choiceIdx,
                    userId: player?.id,
                    userName: player?.name,
                    userEmail: player?.email,
                })
            });
            if (res.ok) {
                const data = await res.json();
                setMatchState(prev => prev ? { ...prev, userPoints: data.userPoints } : null);
                setPicks(prev => prev.map(p => p.id === pickId ? { ...p, selectedChoice: choiceIdx } : p));
            }
        } catch (err) {}
    };

    const handleSubmitChat = async (text) => {
        if (!requirePlayer()) return;
        try {
            const res = await authedFetch(`${API_BASE}/submit-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, user: player?.name || 'You', tag: 'LIVE ROOM' })
            });
            if (res.ok) {
                const data = await res.json();
                setChat(prev => [...prev, data.message]);
                setMatchState(prev => prev ? { ...prev, userPoints: data.userPoints } : null);
            }
        } catch (err) {}
    };

    const handleRateMoment = async (momentId, stars) => {
        if (!requirePlayer()) return;
        try {
            const res = await authedFetch(`${API_BASE}/rate-moment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: momentId, stars })
            });
            if (res.ok) {
                const data = await res.json();
                setMoments(prev => prev.map(m => m.id === momentId ? data.moment : m));
                setMatchState(prev => prev ? { ...prev, userPoints: data.userPoints } : null);
                setSelectedModalMoment(data.moment);
            }
        } catch (err) {}
    };

    const activePicksCount = picks.filter(p => p.status === 'active' && p.selectedChoice === null).length;

    return (
        <div className="app-container">
            <div className="ambient-grid"></div>

            <header className="topbar glass-panel">
                <div className="product-lockup">
                    <div className="brand-mark">
                        <span>P</span>
                    </div>
                    <div>
                        <p className="eyebrow">Pulse Play</p>
                        <h1>Live cricket game room</h1>
                    </div>
                </div>

                <div className="topbar-actions">
                    {player ? (
                        <div className="player-chip">
                            <span>{player.initials}</span>
                            <div>
                                <strong>{player.name}</strong>
                                <button className="mini-text-action" onClick={logoutPlayer}>Sign out</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <button className="ghost-action" onClick={() => { setAuthMode('login'); setShowAuth(true); }}>Log in</button>
                            <button className="primary-action compact" onClick={() => { setAuthMode('signup'); setShowAuth(true); }}>Sign up</button>
                        </>
                    )}
                </div>
            </header>

            {liveMatches.length > 0 && (
                <div className="match-switcher-dock glass-panel">
                    <span className="dock-label">
                        <i className="fa-solid fa-tower-broadcast text-red"></i> Live Matches
                    </span>
                    {liveMatches.map((m) => (
                        <button
                            key={m.guid}
                            onClick={() => handleSwitchMatch(m.guid)}
                            className={`fixture-pill ${activeGuid === m.guid ? 'active' : ''}`}
                        >
                            <span className={`status-dot ${m.isLive ? 'on' : ''}`}></span>
                            {m.title}
                        </button>
                    ))}
                </div>
            )}

            <Header matchState={matchState} />

            <main className="main-workspace">
                <section className="second-screen-hub glass-panel">
                    <div className="live-strip">
                        <span>
                            <i className="fa-solid fa-bolt text-yellow"></i> Live Pulse
                        </span>
                        <strong>{commentary || 'Waiting for the next live update...'}</strong>
                    </div>

                    <nav className="tab-nav">
                        <button onClick={() => setActiveTab('dashboard')} className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}>
                            <i className="fa-solid fa-chart-line"></i> Arena
                        </button>
                        <button onClick={() => setActiveTab('timeline')} className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}>
                            <i className="fa-solid fa-bolt"></i> Plays
                            <span className="count-badge">{moments.length}</span>
                        </button>
                        <button onClick={() => setActiveTab('picks')} className={`tab-btn ${activeTab === 'picks' ? 'active' : ''}`}>
                            <i className="fa-solid fa-crosshairs"></i> Picks
                            {activePicksCount > 0 && <span className="live-badge">{activePicksCount} open</span>}
                        </button>
                        <button onClick={() => setActiveTab('fanzone')} className={`tab-btn ${activeTab === 'fanzone' ? 'active' : ''}`}>
                            <i className="fa-solid fa-users"></i> Room
                        </button>
                        <button onClick={() => setActiveTab('tactical')} className={`tab-btn ${activeTab === 'tactical' ? 'active' : ''}`}>
                            <i className="fa-solid fa-compass-drafting"></i> Intel
                        </button>
                    </nav>

                    {activeTab === 'dashboard' && <DashboardTab matchState={matchState} onCheer={handleCheerTrigger} />}
                    {activeTab === 'timeline' && <TimelineTab moments={moments} onOpenModal={setSelectedModalMoment} />}
                    {activeTab === 'picks' && <PicksTab picks={picks} onSubmitPick={handleSubmitPick} />}
                    {activeTab === 'fanzone' && <FanZoneTab chat={chat} onSubmitChat={handleSubmitChat} isSignedIn={Boolean(player)} onJoin={() => setShowAuth(true)} />}
                    {activeTab === 'tactical' && <TacticalTab matchState={matchState} />}
                </section>
            </main>

            {selectedModalMoment && (
                <div onClick={() => setSelectedModalMoment(null)} className="modal-backdrop">
                    <div onClick={event => event.stopPropagation()} className="moment-modal glass-panel">
                        <div className="modal-header">
                            <h3>
                                <span>{selectedModalMoment.over}</span>
                                {selectedModalMoment.title}
                            </h3>
                            <button onClick={() => setSelectedModalMoment(null)} className="icon-button">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="stat-grid compact-grid">
                                <div><span>Over</span><strong>{selectedModalMoment.over}</strong></div>
                                <div><span>Type</span><strong>{selectedModalMoment.type}</strong></div>
                                <div><span>Pulse</span><strong>{selectedModalMoment.userRated ? `${selectedModalMoment.userStars}/5` : selectedModalMoment.rating}</strong></div>
                            </div>

                            <p>{selectedModalMoment.description}</p>

                            <div className="rating-row">
                                <h4>Rate this moment</h4>
                                <div>
                                    {[1, 2, 3, 4, 5].map(star => {
                                        const isActive = selectedModalMoment.userRated && star <= selectedModalMoment.userStars;
                                        return (
                                            <button
                                                key={star}
                                                onClick={() => handleRateMoment(selectedModalMoment.id, star)}
                                                className={`star-button ${isActive ? 'active' : ''}`}
                                            >
                                                <i className="fa-solid fa-star"></i>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAuth && (
                <AuthPanel
                    mode={authMode}
                    onModeChange={setAuthMode}
                    onSubmit={completeAuth}
                    onClose={() => setShowAuth(false)}
                />
            )}
        </div>
    );
}
