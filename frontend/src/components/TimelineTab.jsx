import React from 'react';

export default function TimelineTab({ moments, onOpenModal }) {
    return (
        <div className="tab-viewport">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-light" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
                <span className="text-xs text-muted">
                    Every ball and turning point flowing into the live room.
                </span>
                <span className="text-xs font-extrabold text-blue bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200" style={{ background: 'rgba(66, 133, 244, 0.08)', color: 'var(--google-blue)', padding: '0.4rem 0.8rem', borderRadius: '99px', fontWeight: 800 }}>
                    {moments?.length || 0} Plays
                </span>
            </div>

            <div className="timeline-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {moments?.map((m) => (
                    <div 
                        key={m.id} 
                        onClick={() => onOpenModal(m)}
                        className={`timeline-card type-${m.type}`}
                        style={{
                            background: 'var(--bg-surface)', border: '1px solid var(--border-light)', padding: '1.5rem', borderRadius: '16px',
                            display: 'flex', gap: '1.5rem', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: 'var(--shadow-sm)',
                            borderLeft: m.type === 'equation' ? '5px solid var(--google-yellow)' : m.type === 'score' ? '5px solid var(--google-blue)' : '5px solid var(--google-red)'
                        }}
                    >
                        <div className="over-pill" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '60px', paddingRight: '1rem', borderRight: '1px solid var(--border-light)' }}>
                            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-main)', lineHeight: 1 }}>{m.over}</span>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>OVER</span>
                        </div>

                        <div className="moment-data" style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{m.type.toUpperCase()} FEED</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--google-yellow)' }}>
                                    ★ {m.userRated ? `${m.userStars}/5 (You)` : m.rating}
                                </span>
                            </div>

                            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.2rem' }}>{m.title}</h4>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{m.description}</p>

                            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--google-blue)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <i className="fa-solid fa-expand"></i> Inspect Play Tracker Overlay
                            </div>
                        </div>
                    </div>
                ))}
                {(!moments || moments.length === 0) && (
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', padding: '1.5rem', borderRadius: '16px', color: 'var(--text-muted)' }}>
                        The first live play will appear here as soon as the match room receives it.
                    </div>
                )}
            </div>
        </div>
    );
}
