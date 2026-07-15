export default function Header({ matchState }) {
    if (!matchState) return null;

    const { title, link, runs, wickets, target, userPoints, ballsRemaining, runsRequired, currentStriker, currentBowler, status } = matchState;
    const scoreText = runs !== null && runs !== undefined ? `${runs}/${wickets ?? '-'}` : '--';
    const targetText = target !== null && target !== undefined ? target : '--';

    return (
        <header className="match-header glass">
            <div className="match-header-top">
                <div className="ipl-live-pill">
                    <span className="pulse-dot"></span>
                    Live Match
                </div>

                <h1 className="match-title-display">{title || 'Fetching live matches...'}</h1>

                {link && link !== '#' && (
                    <a href={link} target="_blank" rel="noreferrer" className="scorecard-link">
                        Scorecard <span className="material-symbols-rounded" style={{ fontSize: 16 }}>arrow_outward</span>
                    </a>
                )}
            </div>

            <div className="scoreboard-core">
                <div className="score-cell">
                    <span className="cell-label">Score</span>
                    <span className="runs-num">{scoreText}</span>
                </div>

                <div className="score-cell">
                    <span className="cell-label">Target</span>
                    <strong>{targetText}</strong>
                    {runsRequired !== null && runsRequired !== undefined && ballsRemaining !== null && ballsRemaining !== undefined && (
                        <small>Need {runsRequired} from {ballsRemaining}</small>
                    )}
                </div>

                <div className="score-cell points">
                    <span className="cell-label">Pulse Points</span>
                    <strong>{userPoints?.toLocaleString() ?? 0}</strong>
                </div>
            </div>

            {(status || currentStriker || currentBowler) && (
                <div className="match-header-meta">
                    {status && <span>{status}</span>}
                    {currentStriker && <span>Striker <strong>{currentStriker}</strong></span>}
                    {currentBowler && <span>Bowler <strong>{currentBowler}</strong></span>}
                </div>
            )}
        </header>
    );
}
