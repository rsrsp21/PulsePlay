export default function Header({ matchState }) {
    if (!matchState) return null;

    const {
        title, link, runs, wickets, oversText, target, userPoints,
        ballsRemaining, runsRequired, crr, rrr, battingTeam, opponent,
        striker, nonStriker, bowler, status,
    } = matchState;

    const scoreText = runs !== null && runs !== undefined ? `${runs}/${wickets ?? '-'}` : '--';
    const chasing = runsRequired !== null && runsRequired !== undefined && ballsRemaining !== null && ballsRemaining !== undefined;
    const batLine = (b) => (b ? `${b.runs ?? 0} (${b.balls ?? 0})` : null);

    return (
        <header className="match-header glass">
            <div className="match-header-top">
                <div className="ipl-live-pill">
                    <span className="pulse-dot"></span>
                    Live
                </div>
                <h1 className="match-title-display">{title || 'Fetching live matches...'}</h1>
                {link && link !== '#' && (
                    <a href={link} target="_blank" rel="noreferrer" className="scorecard-link">
                        Cricbuzz <span className="material-symbols-rounded" style={{ fontSize: 16 }}>arrow_outward</span>
                    </a>
                )}
            </div>

            <div className="scoreline">
                <div className="scoreline-main">
                    <span className="cell-label">{battingTeam ? `${battingTeam} batting` : 'Score'}</span>
                    <div className="scoreline-runs">
                        <span className="runs-num">{scoreText}</span>
                        {oversText && <span className="scoreline-overs">{oversText} ov</span>}
                    </div>
                    {chasing && (
                        <span className="chase-line">
                            Need <strong>{runsRequired}</strong> off <strong>{ballsRemaining}</strong>
                            {opponent ? ` vs ${opponent}` : ''}
                        </span>
                    )}
                    {!chasing && status && <span className="chase-line">{status}</span>}
                </div>

                <div className="scoreline-stats">
                    {crr != null && <div className="stat-chip"><span>CRR</span><strong>{crr}</strong></div>}
                    {chasing && rrr != null && <div className="stat-chip"><span>RRR</span><strong>{rrr}</strong></div>}
                    {target != null && <div className="stat-chip"><span>Target</span><strong>{target}</strong></div>}
                    <div className="stat-chip points"><span>Pulse</span><strong>{userPoints?.toLocaleString() ?? 0}</strong></div>
                </div>
            </div>

            {(striker || nonStriker || bowler) && (
                <div className="batters-row">
                    {striker && (
                        <div className="batter on-strike">
                            <span className="material-symbols-rounded meta-ic">sports_cricket</span>
                            <strong>{striker.name}</strong>
                            <span className="on-strike-dot" title="On strike"></span>
                            <span className="batter-score">{batLine(striker)}</span>
                        </div>
                    )}
                    {nonStriker && (
                        <div className="batter">
                            <strong>{nonStriker.name}</strong>
                            <span className="batter-score">{batLine(nonStriker)}</span>
                        </div>
                    )}
                    {bowler && (
                        <div className="batter bowler-info">
                            <span className="material-symbols-rounded meta-ic">sports_baseball</span>
                            <strong>{bowler.name}</strong>
                            <span className="batter-score">{bowler.wickets ?? 0}/{bowler.runs ?? 0} ({bowler.overs ?? 0})</span>
                        </div>
                    )}
                </div>
            )}
        </header>
    );
}
