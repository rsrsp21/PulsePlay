export default function TacticalTab({ matchState }) {
    return (
        <div className="tab-viewport">
            <div className="section-heading">
                <div>
                    <p className="eyebrow">Match Intel</p>
                    <h2>Live context at a glance</h2>
                    <p className="text-xs text-muted mt-1">
                        Clean live context for the innings, chase, and players in action.
                    </p>
                </div>
            </div>

            <div className="intel-grid">
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
                    <div key={label} className="intel-card">
                        <div className="label">{label}</div>
                        <div className="value">{value ?? '--'}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
