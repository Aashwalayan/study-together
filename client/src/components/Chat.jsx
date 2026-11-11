import { useEffect, useRef, useState } from 'react';

export default function Chat({ messages, myUserId, onSend }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <section className="panel chat">
      <h2>Chat</h2>
      <ul className="messages" aria-live="polite">
        {messages.length === 0 && <li className="muted small">No messages yet. Say hi.</li>}
        {messages.map((m) => (
          <li key={m.id} className={m.userId === myUserId ? 'mine' : ''}>
            <span className="author">{m.userId === myUserId ? 'You' : m.userName}</span>
            <span>{m.text}</span>
          </li>
        ))}
        <li ref={endRef} />
      </ul>
      <form onSubmit={submit} className="chat-form">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Message the room" />
        <button className="primary">Send</button>
      </form>
    </section>
  );
}
