import React from 'react';

export default function Header({ matchState }) {
    if (!matchState) return null;

    const { title, link, runs, wickets, target, userPoints, ballsRemaining, runsRequired, currentStriker, currentBowler, status } = matchState;
    const scoreText = runs !== null && runs !== undefined ? `${runs}/${wickets ?? '-'}` : '--';
    const targetText = target !== null && target !== undefined ? target : '--';

    return (
        <header className="match-header">
            <div className="flex items-center gap-4 flex-wrap">
                <div className="ipl-live-pill">
                    <span className="pulse-dot"></span>
                    <span className="pill-text">Live Match</span>
                </div>

                <h1 className="match-title-display">
                    <i className="fa-solid fa-trophy text-yellow mr-2" style={{ marginRight: '0.4rem' }}></i>
                    {title || "Fetching live matches..."}
                </h1>

                {link && link !== "#" && (
                    <a 
                        href={link} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs font-bold text-blue underline hover:opacity-80 transition-smooth ml-2"
                        style={{ marginLeft: '0.5rem' }}
                    >
                        Scorecard <i className="fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                )}
            </div>

            <div className="scoreboard-core">
                <div className="runs-box">
                    <span className="runs-num">{scoreText}</span>
                </div>

                <div className="target-badge">
                    <span>Target</span>
                    <strong>{targetText}</strong>
                    {runsRequired !== null && runsRequired !== undefined && ballsRemaining !== null && ballsRemaining !== undefined && (
                        <small style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 700 }}>
                            Need {runsRequired} from {ballsRemaining}
                        </small>
                    )}
                </div>

                <div className="user-score-widget">
                    <i className="fa-solid fa-star widget-icon"></i>
                    <div className="widget-details">
                        <span className="widget-label">PULSE POINTS</span>
                        <span className="widget-points">{userPoints?.toLocaleString()}</span>
                    </div>
                </div>
            </div>
            {(status || currentStriker || currentBowler) && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
                    {status && <span>{status}</span>}
                    {currentStriker && <span>Striker: <strong style={{ color: 'var(--text-main)' }}>{currentStriker}</strong></span>}
                    {currentBowler && <span>Bowler: <strong style={{ color: 'var(--text-main)' }}>{currentBowler}</strong></span>}
                </div>
            )}
        </header>
    );
}
