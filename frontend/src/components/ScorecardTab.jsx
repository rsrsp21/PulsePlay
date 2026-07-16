import { useState } from 'react';

export default function ScorecardTab({ scorecard }) {
    const innings = scorecard?.innings || [];
    const [active, setActive] = useState(0);

    if (!innings.length) {
        return (
            <div className="tab-viewport">
                <div className="empty-card">The full scorecard appears once the innings is underway.</div>
            </div>
        );
    }

    const idx = Math.min(active, innings.length - 1);
    const inn = innings[idx];

    return (
        <div className="tab-viewport">
            <div className="section-heading">
                <div>
                    <p className="eyebrow">Scorecard</p>
                    <h2>Full batting &amp; bowling card</h2>
                </div>
                <span className="source-pill">{scorecard.isComplete ? 'Final' : 'Live'}</span>
            </div>

            {innings.length > 1 && (
                <div className="innings-tabs">
                    {innings.map((entry, i) => (
                        <button
                            key={entry.inningsId}
                            className={`innings-pill ${i === idx ? 'active' : ''}`}
                            onClick={() => setActive(i)}
                        >
                            {entry.battingTeam} {entry.runs}/{entry.wickets}
                        </button>
                    ))}
                </div>
            )}

            <div className="card-summary">
                <strong>{inn.battingTeam}</strong>
                <span className="card-score">{inn.runs}/{inn.wickets}</span>
                <span className="text-muted">({inn.overs} ov)</span>
                {inn.runRate != null && <span className="text-muted">RR {inn.runRate}</span>}
                {inn.extras != null && <span className="text-muted">Extras {inn.extras}</span>}
            </div>

            <div className="score-table-wrap">
                <table className="score-table">
                    <thead>
                        <tr>
                            <th className="left">Batter</th>
                            <th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inn.batsmen.filter((b) => b.balls > 0 || b.notOut || b.runs > 0).map((b) => (
                            <tr key={b.name} className={b.notOut ? 'not-out' : ''}>
                                <td className="left">
                                    <span className="bat-name">{b.name}{b.notOut ? ' *' : ''}</span>
                                    <span className="bat-out">{b.outDesc}</span>
                                </td>
                                <td className="strong">{b.runs}</td>
                                <td>{b.balls}</td>
                                <td>{b.fours}</td>
                                <td>{b.sixes}</td>
                                <td>{b.strikeRate}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="score-table-wrap">
                <table className="score-table">
                    <thead>
                        <tr>
                            <th className="left">Bowler</th>
                            <th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inn.bowlers.map((b) => (
                            <tr key={b.name}>
                                <td className="left"><span className="bat-name">{b.name}</span></td>
                                <td>{b.overs}</td>
                                <td>{b.maidens}</td>
                                <td>{b.runs}</td>
                                <td className="strong">{b.wickets}</td>
                                <td>{b.economy}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
