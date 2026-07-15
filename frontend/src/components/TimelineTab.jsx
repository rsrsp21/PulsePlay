export default function TimelineTab({ moments, onOpenModal }) {
    return (
        <div className="tab-viewport">
            <div className="timeline-head">
                <span className="text-xs text-muted">
                    Every ball and turning point flowing into the live room.
                </span>
                <span className="count-badge">{moments?.length || 0} plays</span>
            </div>

            <div className="timeline-list">
                {moments?.map((m) => (
                    <div key={m.id} onClick={() => onOpenModal(m)} className="timeline-card">
                        <div className="over-pill">
                            <strong>{m.over}</strong>
                            <span>Over</span>
                        </div>

                        <div className="moment-data">
                            <div className="moment-meta">
                                <span className="kind">{m.type}</span>
                                <span className="stars">★ {m.userRated ? `${m.userStars}/5 (You)` : m.rating}</span>
                            </div>
                            <h4>{m.title}</h4>
                            <p>{m.description}</p>
                        </div>
                    </div>
                ))}

                {(!moments || moments.length === 0) && (
                    <div className="empty-card">
                        The first live play will appear here as soon as the match room receives it.
                    </div>
                )}
            </div>
        </div>
    );
}
