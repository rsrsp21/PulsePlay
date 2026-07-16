import { useEffect, useRef, useState } from 'react';

const CHEERS = [
    { key: 'shot', label: 'Shot', icon: 'sports_cricket', color: 'text-red', filled: false },
    { key: 'boundary', label: 'Boundary', icon: 'bolt', color: 'text-blue', filled: false },
    { key: 'maximum', label: 'Maximum', icon: 'star', color: 'text-yellow', filled: true },
    { key: 'catch', label: 'Catch', icon: 'back_hand', color: 'text-green', filled: false },
];

// Module scope keeps the impure id/position generation out of the render body.
let cheerSeq = 0;
function makeBurst(cheer) {
    cheerSeq += 1;
    return {
        id: `cheer-${cheerSeq}`,
        ...cheer,
        left: 8 + Math.random() * 84,
        drift: Math.round((Math.random() - 0.5) * 40),
    };
}

export default function DashboardTab({ matchState, onCheer }) {
    const [bursts, setBursts] = useState([]);
    const timers = useRef([]);

    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    const fireCheer = (cheer) => {
        const burst = makeBurst(cheer);
        setBursts((prev) => [...prev, burst]);
        const t = setTimeout(() => {
            setBursts((prev) => prev.filter((b) => b.id !== burst.id));
            timers.current = timers.current.filter((x) => x !== t);
        }, 1200);
        timers.current.push(t);
        onCheer();
    };

    if (!matchState) return null;

    const { winProbMumbai, winProbChennai, sentimentAngle, crr, rrr, ballsRemaining, currentStriker, currentBowler, recentDeliveries, partnership, lastWicket } = matchState;
    const hasAdvantage = winProbMumbai !== null && winProbMumbai !== undefined && winProbChennai !== null && winProbChennai !== undefined;

    return (
        <div className="tab-viewport">
            <div className="section-heading">
                <div>
                    <p className="eyebrow">Live Arena</p>
                    <h2>Play the match as it happens</h2>
                </div>
                <span className="source-pill">Live engine</span>
            </div>

            <div className="dashboard-grid">
                <div className="insight-card accent-yellow">
                    <h4><span className="material-symbols-rounded card-ic">local_fire_department</span> Room Energy</h4>
                    <div className="energy-meter">
                        <div className="meter-arc">
                            <div className="meter-mask"></div>
                            <div className="meter-needle" style={{ transform: `rotate(${sentimentAngle || 8}deg)` }}></div>
                        </div>
                        <div className="meter-labels">
                            <span className="text-red">Tense</span>
                            <span className="text-yellow">Buzzing</span>
                            <span className="text-green">Electric</span>
                        </div>
                    </div>
                    <p className="muted-copy">Every cheer, pick, and reaction pushes the live room pulse.</p>
                </div>

                <div className="insight-card accent-blue">
                    <h4><span className="material-symbols-rounded card-ic">speed</span> Chase Pressure</h4>
                    {hasAdvantage ? (
                        <div className="pressure-stack">
                            <div className="bar-row">
                                <label><span>Chasing side</span><strong>{winProbMumbai}%</strong></label>
                                <div className="track"><div className="fill blue" style={{ width: `${winProbMumbai}%` }}></div></div>
                            </div>
                            <div className="bar-row">
                                <label><span>Defending side</span><strong>{winProbChennai}%</strong></label>
                                <div className="track"><div className="fill red" style={{ width: `${winProbChennai}%` }}></div></div>
                            </div>
                        </div>
                    ) : (
                        <p className="muted-copy">Chase pressure unlocks when the match has a target and balls remaining.</p>
                    )}

                    <div className="mini-stat-row">
                        <span>CRR <strong>{crr ?? '--'}</strong></span>
                        <span>RRR <strong>{rrr ?? '--'}</strong></span>
                        <span>Left <strong>{ballsRemaining ?? '--'}</strong></span>
                    </div>
                </div>

                <div className="insight-card accent-green">
                    <h4><span className="material-symbols-rounded card-ic">sports_cricket</span> Middle</h4>
                    <div className="player-vs">
                        <div>
                            <span>Striker</span>
                            <strong>{currentStriker || '--'}</strong>
                        </div>
                        <div>
                            <span>Bowler</span>
                            <strong>{currentBowler || '--'}</strong>
                        </div>
                    </div>
                    <div className="recent-strip">
                        {(recentDeliveries?.length ? recentDeliveries : ['--']).map((ball, index) => (
                            <span
                                key={`${ball}-${index}`}
                                className={/W/i.test(ball) ? 'out' : /4|6/.test(ball) ? 'hot' : ''}
                            >
                                {ball}
                            </span>
                        ))}
                    </div>
                    {partnership && (
                        <div className="mini-stat-row">
                            <span>Partnership <strong>{partnership.runs} ({partnership.balls})</strong></span>
                        </div>
                    )}
                    {lastWicket && <p className="muted-copy">Last out: {lastWicket}</p>}
                </div>
            </div>

            <div className="cheer-panel">
                <div className="reaction-layer" aria-hidden="true">
                    {bursts.map((b) => (
                        <span
                            key={b.id}
                            className={`reaction-float material-symbols-rounded ${b.color} ${b.filled ? 'filled' : ''}`}
                            style={{ left: `${b.left}%`, '--drift': `${b.drift}px` }}
                        >
                            {b.icon}
                        </span>
                    ))}
                </div>
                <div>
                    <p className="eyebrow">Interact</p>
                    <h4>Send a live reaction</h4>
                </div>
                <div className="cheer-actions">
                    {CHEERS.map((cheer) => (
                        <button key={cheer.key} onClick={() => fireCheer(cheer)}>
                            <span className={`material-symbols-rounded ${cheer.color} ${cheer.filled ? 'filled' : ''}`}>{cheer.icon}</span>
                            {cheer.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
