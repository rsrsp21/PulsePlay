import React, { useEffect, useState } from 'react';

function secondsLeft(expiresAt) {
    if (!expiresAt) return 0;
    return Math.max(0, Math.ceil(expiresAt - Date.now() / 1000));
}

export default function PicksTab({ picks, onSubmitPick }) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="tab-viewport">
            <div className="section-heading">
                <div>
                    <p className="eyebrow">Pulse Picks</p>
                    <h2>AI prediction rounds</h2>
                    <p className="text-sm text-muted mt-1">A new challenge opens every 3 balls. Beat the timer, hit the call, win Pulse Points.</p>
                </div>
                <span className="source-pill">Gemini powered</span>
            </div>

            <div className="picks-list">
                {picks?.map((p) => {
                    const left = secondsLeft(p.expiresAt);
                    const isClosed = p.status !== 'active' || left <= 0;
                    return (
                        <div
                            key={p.id}
                            className="pick-item-card glass-panel"
                            style={{ borderLeft: p.status === 'active' ? '4px solid var(--google-blue)' : '4px solid var(--google-green)' }}
                        >
                            <div className="pick-status-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                                <span className="badge-live-pick" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 800, padding: '0.3rem 0.8rem', borderRadius: '99px' }}>
                                    <span className="pulse-dot" style={{ width: '8px', height: '8px' }}></span>
                                    {p.status === 'active' ? `LOCK IN ${left}s` : 'ROUND CLOSED'}
                                </span>
                                <span className="pick-reward" style={{ fontWeight: 900, color: 'var(--google-green)', fontSize: '0.9rem' }}>
                                    +{p.ptsReward ?? 0} PTS
                                </span>
                            </div>

                            <p className="pick-question text-main" style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1.25rem' }}>
                                {p.question}
                            </p>

                            <div className="pick-choices-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
                                {p.choices.map((choice, idx) => {
                                    const isSelected = p.selectedChoice === idx;
                                    const isCorrect = p.correctChoiceIndex === idx;
                                    const isDisabled = isClosed || p.selectedChoice !== null;

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => onSubmitPick(p.id, idx)}
                                            disabled={isDisabled}
                                            style={{
                                                padding: '0.9rem 1rem',
                                                borderRadius: '8px',
                                                border: isCorrect ? '2px solid var(--google-green)' : isSelected ? '2px solid var(--google-blue)' : '1px solid var(--border-glass)',
                                                background: isCorrect ? 'rgba(52, 168, 83, 0.14)' : isSelected ? 'var(--google-blue)' : 'var(--bg-surface)',
                                                color: isSelected ? '#FFF' : 'var(--text-main)',
                                                fontWeight: isSelected || isCorrect ? 850 : 650,
                                                fontSize: '0.9rem',
                                                cursor: isDisabled ? 'default' : 'pointer',
                                                transition: 'all 0.2s ease',
                                                boxShadow: isSelected ? 'var(--glow-blue)' : 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.45rem',
                                                textAlign: 'center'
                                            }}
                                        >
                                            {isSelected && <i className="fa-solid fa-check"></i>}
                                            {isCorrect && <i className="fa-solid fa-trophy text-green"></i>}
                                            {choice}
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 750 }}>
                                <span>Window: ball {p.startBall} to {p.endBall}</span>
                                <span>Agent: {p.generatedBy === 'gemini' ? 'Gemini' : 'Pulse Play'}</span>
                                {p.resultText && <span className="text-green">{p.resultText}</span>}
                            </div>
                        </div>
                    );
                })}

                {(!picks || picks.length === 0) && (
                    <div className="glass-panel" style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>
                        The next AI round opens as soon as the live match has enough ball-by-ball context.
                    </div>
                )}
            </div>
        </div>
    );
}
