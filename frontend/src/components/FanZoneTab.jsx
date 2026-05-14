import React, { useState, useRef, useEffect } from 'react';

export default function FanZoneTab({ chat, onSubmitChat, isSignedIn, onJoin }) {
    const [text, setText] = useState('');
    const streamRef = useRef(null);

    useEffect(() => {
        if (streamRef.current) {
            streamRef.current.scrollTop = streamRef.current.scrollHeight;
        }
    }, [chat]);

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!isSignedIn) {
            onJoin?.();
            return;
        }
        if (!text.trim()) return;
        onSubmitChat(text);
        setText('');
    };

    return (
        <div className="tab-viewport">
            <div className="room-shell glass-panel">
                <div className="room-header">
                    <div>
                        <p className="eyebrow">Live Room</p>
                        <h3>Match chat and fan signals</h3>
                    </div>
                    <span className="source-pill">{isSignedIn ? 'Playing' : 'Join to interact'}</span>
                </div>

                <div ref={streamRef} className="chat-stream">
                    {chat?.map((msg, idx) => {
                        const isUser = msg.user === 'You (Fan)' || msg.tag === 'LIVE ROOM';
                        return (
                            <div key={idx} className={`chat-bubble ${isUser ? 'mine' : ''}`}>
                                <div>
                                    <span>{msg.user}</span>
                                    <small>{msg.tag}</small>
                                </div>
                                <p>{msg.text}</p>
                            </div>
                        );
                    })}
                </div>

                <form onSubmit={handleSubmit} className="chat-composer">
                    <input
                        type="text"
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        placeholder={isSignedIn ? 'React to the match...' : 'Sign up to join the live room'}
                        maxLength={120}
                    />
                    <button type="submit" aria-label="Send">
                        <i className="fa-solid fa-paper-plane"></i>
                    </button>
                </form>
            </div>
        </div>
    );
}
