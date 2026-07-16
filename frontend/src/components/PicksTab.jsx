import { useEffect, useState } from 'react';

function secondsLeft(expiresAt, now) {
    if (!expiresAt) return 0;
    return Math.max(0, Math.ceil(expiresAt - now / 1000));
}

export default function PicksTab({ picks, onSubmitPick }) {
    const [now, setNow] = useState(0);

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
                    <p className="text-sm text-muted mt-1">The AI reads the live scorecard and sets a fresh challenge each over. Beat the timer, hit the call, win Pulse Points.</p>
                </div>
                <span className="source-pill">Gemini powered</span>
            </div>

            <div className="picks-list">
                {picks?.map((p) => {
                    const left = now ? secondsLeft(p.expiresAt, now) : null;
                    const isResolved = p.status !== 'active';
                    const isClosed = isResolved || (left !== null && left <= 0);
                    return (
                        <div key={p.id} className="pick-item-card">
                            <div className="pick-status-bar">
                                <span className={`badge-live-pick ${isClosed ? 'closed' : ''}`}>
                                    {!isClosed && <span className="pulse-dot"></span>}
                                    {isResolved
                                        ? 'Round closed'
                                        : isClosed
                                            ? 'Locked · awaiting result'
                                            : left === null
                                                ? 'Live round'
                                                : `Lock in ${left}s`}
                                </span>
                                <span className="pick-reward">+{p.ptsReward ?? 0} pts</span>
                            </div>

                            <p className="pick-question">{p.question}</p>

                            <div className="pick-choices-grid">
                                {p.choices.map((choice, idx) => {
                                    const isSelected = p.selectedChoice === idx;
                                    const isCorrect = p.correctChoiceIndex === idx;
                                    const isDisabled = isClosed || p.selectedChoice !== null;

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => onSubmitPick(p.id, idx)}
                                            disabled={isDisabled}
                                            className={`choice-btn ${isCorrect ? 'correct' : isSelected ? 'selected' : ''}`}
                                        >
                                            {isSelected && <span className="material-symbols-rounded" style={{ fontSize: 18 }}>check</span>}
                                            {isCorrect && <span className="material-symbols-rounded filled" style={{ fontSize: 18 }}>trophy</span>}
                                            {choice}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="pick-meta">
                                <span>Resolves over {p.horizonBalls ?? 1} ball{(p.horizonBalls ?? 1) === 1 ? '' : 's'}</span>
                                <span>Agent: {p.generatedBy === 'Gemini' ? 'Gemini' : 'Pulse Play'}</span>
                                {p.resultText && <span className={isResolved ? 'text-green' : ''}>{p.resultText}</span>}
                            </div>
                        </div>
                    );
                })}

                {(!picks || picks.length === 0) && (
                    <div className="empty-card">
                        The next AI round opens as soon as the live match has enough ball-by-ball context.
                    </div>
                )}
            </div>
        </div>
    );
}
