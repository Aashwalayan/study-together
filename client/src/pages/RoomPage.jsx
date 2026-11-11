import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { createSocket } from '../socket.js';
import ClassroomScene from '../components/ClassroomScene.jsx';
import Chat from '../components/Chat.jsx';
import PomodoroTimer from '../components/PomodoroTimer.jsx';
import PresenceList from '../components/PresenceList.jsx';

const BUBBLE_MS = 5000;

export default function RoomPage() {
  const { roomId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const socketRef = useRef(null);
  const offsetRef = useRef(0); // serverTime - clientTime, for the shared timer
  const [room, setRoom] = useState(null);
  const [seats, setSeats] = useState([]);
  const [occupants, setOccupants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [timer, setTimer] = useState(null);
  const [bubbles, setBubbles] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = createSocket(token);
    socketRef.current = socket;
    const bubbleTimers = {};

    const showBubble = (userId, text) => {
      setBubbles((b) => ({ ...b, [userId]: text }));
      clearTimeout(bubbleTimers[userId]);
      bubbleTimers[userId] = setTimeout(() => {
        setBubbles((b) => {
          const { [userId]: _removed, ...rest } = b;
          return rest;
        });
      }, BUBBLE_MS);
    };

    const join = () =>
      socket.emit('room:join', { roomId }, (res) => {
        if (!res?.ok) {
          setError(res?.error || 'Could not join this room');
          return;
        }
        setError('');
        offsetRef.current = res.serverNow - Date.now();
        setRoom(res.room);
        setSeats(res.seats);
        setOccupants(res.occupants);
        setMessages(res.messages);
        setTimer(res.timer);
      });

    socket.on('connect', () => {
      setConnected(true);
      join(); // also re-runs after a dropped connection
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => setError(err.message));
    socket.on('presence:update', setOccupants);
    socket.on('chat:message', (msg) => {
      setMessages((m) => [...m.slice(-199), msg]);
      showBubble(msg.userId, msg.text);
    });
    socket.on('timer:update', ({ timer: t, serverNow }) => {
      offsetRef.current = serverNow - Date.now();
      setTimer(t);
    });
    socket.on('room:kicked', () => {
      window.alert('The room owner removed you from this room.');
      navigate('/');
    });

    return () => {
      Object.values(bubbleTimers).forEach(clearTimeout);
      socket.emit('room:leave');
      socket.disconnect();
    };
  }, [roomId, token, navigate]);

  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(id);
  }, [notice]);

  const emit = (event, payload) =>
    socketRef.current?.emit(event, payload, (res) => {
      if (res && !res.ok) setNotice(res.error);
    });

  const mySeatId = useMemo(
    () => occupants.find((o) => o.userId === user.id)?.seatId ?? null,
    [occupants, user.id]
  );
  const isOwner = room?.ownerId === user.id;

  if (error && !room) {
    return (
      <main className="center-note">
        <p className="error">{error}</p>
        <Link to="/">Back to rooms</Link>
      </main>
    );
  }

  return (
    <div className="room-layout">
      <section className="scene-pane">
        <div className="scene-bar">
          <Link to="/">← Rooms</Link>
          <strong>{room?.name ?? 'Joining…'}</strong>
          <span className={connected ? 'dot on' : 'dot'} title={connected ? 'Connected' : 'Reconnecting'} />
          {mySeatId ? (
            <button onClick={() => emit('seat:stand')}>Stand up</button>
          ) : (
            <span className="muted small">Click an empty bench to sit</span>
          )}
        </div>
        {notice && <div className="toast" role="status">{notice}</div>}
        <ClassroomScene
          seats={seats}
          occupants={occupants}
          myUserId={user.id}
          bubbles={bubbles}
          phase={timer?.phase ?? 'idle'}
          onSit={(seatId) => emit('seat:sit', { seatId })}
        />
      </section>

      <aside className="sidebar">
        <PomodoroTimer
          timer={timer}
          offsetRef={offsetRef}
          isOwner={isOwner}
          onStart={() => emit('timer:start')}
          onReset={() => emit('timer:reset')}
        />
        <PresenceList
          occupants={occupants}
          myUserId={user.id}
          ownerId={room?.ownerId}
          isOwner={isOwner}
          onKick={(userId) => emit('mod:kick', { userId })}
        />
        <Chat messages={messages} myUserId={user.id} onSend={(text) => emit('chat:send', { text })} />
      </aside>
    </div>
  );
}
