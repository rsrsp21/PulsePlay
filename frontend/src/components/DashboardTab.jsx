import React from 'react';

export default function DashboardTab({ matchState, onCheer }) {
    if (!matchState) return null;

    const { winProbMumbai, winProbChennai, sentimentAngle, crr, rrr, ballsRemaining, runsRequired, currentStriker, currentBowler, recentDeliveries } = matchState;
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
                <div className="insight-card c-yellow">
                    <h4>Room Energy</h4>
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

                <div className="insight-card c-blue">
                    <h4>Chase Pressure</h4>
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

                <div className="insight-card c-green">
                    <h4>On Strike</h4>
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
                            <span key={`${ball}-${index}`}>{ball}</span>
                        ))}
                    </div>
                    <p className="muted-copy">{runsRequired ? `${runsRequired} runs still on the board.` : 'Waiting for the next live equation.'}</p>
                </div>
            </div>

            <div className="cheer-panel">
                <div>
                    <p className="eyebrow">Interact</p>
                    <h4>Send a live reaction</h4>
                </div>
                <div className="cheer-actions">
                    <button onClick={onCheer}><i className="fa-solid fa-fire text-red"></i> Shot</button>
                    <button onClick={onCheer}><i className="fa-solid fa-bolt text-blue"></i> Boundary</button>
                    <button onClick={onCheer}><i className="fa-solid fa-star text-yellow"></i> Maximum</button>
                    <button onClick={onCheer}><i className="fa-solid fa-hands-clapping text-green"></i> Catch</button>
                </div>
            </div>
        </div>
    );
}
