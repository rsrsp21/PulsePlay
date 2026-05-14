import React from 'react';

export default function TacticalTab({ matchState }) {
    return (
        <div className="tab-viewport">
            <div className="mb-6 pb-4 border-b border-light" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
                <h3 className="text-xl font-extrabold text-main" style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                    Match Intel
                </h3>
                <p className="text-xs text-muted mt-1">
                    Clean live context for the innings, chase, and players in action.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                {[
                    ['Batting team', matchState?.battingTeam],
                    ['Bowling team', matchState?.opponent],
                    ['Striker', matchState?.currentStriker],
                    ['Non-striker', matchState?.currentNonStriker],
                    ['Bowler', matchState?.currentBowler],
                    ['Recent balls', matchState?.recentDeliveries?.join(' ')],
                    ['Overs', matchState?.oversText],
                    ['Balls bowled', matchState?.ballsBowled],
                    ['Balls remaining', matchState?.ballsRemaining],
                    ['Wickets remaining', matchState?.wicketsRemaining],
                    ['Target', matchState?.target],
                    ['Runs required', matchState?.runsRequired],
                    ['Current run rate', matchState?.crr],
                    ['Required run rate', matchState?.rrr],
                    ['Status', matchState?.status],
                    ['Source', matchState?.source],
                ].map(([label, value]) => (
                    <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                            {label}
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                            {value ?? '--'}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
