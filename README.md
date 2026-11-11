# Study Together

A virtual study hall in the browser. Join a room, pick a bench in a 3D classroom, and your avatar sits there. Chat with the room and focus together on a shared Pomodoro timer.

This is the **foundation**: auth, rooms, real-time chat, presence, shared timer and seat-based avatars. The classroom art is intentionally simple (boxes and capsules) so you can build features first and swap in real models later.

## Features

- Email and password accounts (JWT, bcrypt)
- Public rooms, plus private rooms joined with an invite code
- Click a bench to sit. The server assigns seats, so two people can never take the same one
- Real-time room chat, last 50 messages stored in MongoDB, with speech bubbles above avatars
- Shared focus/break timer controlled by the room owner, in sync for everyone including late joiners
- Presence list showing who is in the room, what they study and where they sit
- Owner moderation: remove a user from the room
- Rate limiting on the API, on login and register, and on chat messages

## Tech stack

| Part | Tech |
| --- | --- |
| Frontend | React 18, Vite, React Router |
| 3D | three.js via React Three Fiber and drei |
| Backend | Node.js, Express |
| Real-time | Socket.IO |
| Database | MongoDB with Mongoose |

## Project structure

```
study-together/
├── package.json            # root scripts (run both apps together)
├── server/
│   ├── .env.example
│   └── src/
│       ├── index.js        # Express + Socket.IO bootstrap
│       ├── config.js       # env handling
│       ├── db.js
│       ├── models/         # User, Room, Message
│       ├── middleware/auth.js
│       ├── routes/         # auth.js, rooms.js (REST)
│       ├── socket/
│       │   ├── index.js    # socket events (join, chat, seats, timer, kick)
│       │   └── roomState.js# in-memory seats, presence and timer
│       └── utils/seats.js  # seat layout (edit this to change the classroom)
└── client/
    ├── .env.example
    └── src/
        ├── App.jsx, main.jsx, styles.css, api.js, socket.js
        ├── context/AuthContext.jsx
        ├── pages/          # AuthPage, RoomsPage, RoomPage
        └── components/     # ClassroomScene, Chat, PomodoroTimer, PresenceList
```

## Getting started

### Prerequisites

- Node.js 18.18 or newer
- MongoDB running locally, or a free MongoDB Atlas cluster

### Setup

```bash
# 1. Install everything (root, server and client)
npm run install:all

# 2. Configure the server
cp server/.env.example server/.env
#    then edit server/.env: set MONGODB_URI and a long random JWT_SECRET

# 3. (Optional) configure the client. Not needed in development.
cp client/.env.example client/.env

# 4. Run server and client together
npm run dev
```

Open http://localhost:5173, create two accounts in two different browsers (or one normal and one private window), join the same room and try sitting and chatting.

The Vite dev server proxies `/api` and `/socket.io` to `localhost:5000`, so there are no CORS issues in development.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Server (watch mode) and client together |
| `npm run dev:server` / `npm run dev:client` | Run one side only |
| `npm run build` | Production build of the client into `client/dist` |
| `npm start` | Start the server without watch mode |

### Environment variables

**server/.env**

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/study-together` |
| `JWT_SECRET` | Secret used to sign tokens. Required in production | dev-only fallback |
| `CLIENT_URL` | Allowed browser origin(s), comma separated | `http://localhost:5173` |

**client/.env** (production only)

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Base URL of the API, e.g. `https://api.example.com` |
| `VITE_SOCKET_URL` | Socket.IO server URL (usually the same as the API) |

## How it works

### Seats

The server owns the seat layout (`server/src/utils/seats.js`): each seat has an id and a position. The client only draws what it is told.

1. The user clicks a free bench and the client emits `seat:sit` with the seat id.
2. The server checks the seat exists and is free, assigns it and broadcasts `presence:update`.
3. Every client renders an avatar at every occupied seat.

Only seat assignments are synced, not positions or movement, which keeps traffic tiny.

### Shared timer

The server stores the phase (`focus` or `break`) and `endsAt`, a server timestamp. Clients compute the remaining time themselves, corrected by a clock offset (`serverNow - Date.now()`) sent with every update, so everyone sees the same countdown and late joiners are instantly in sync. The server flips between focus and break automatically when a phase ends. Durations are set per room when it is created.

### Socket events

Client to server (all use acknowledgement callbacks returning `{ ok, error? }`):

| Event | Payload | Who |
| --- | --- | --- |
| `room:join` | `{ roomId }` | anyone allowed in the room |
| `room:leave` | none | anyone |
| `chat:send` | `{ text }` | anyone in the room (rate limited) |
| `seat:sit` | `{ seatId }` | anyone in the room |
| `seat:stand` | none | anyone in the room |
| `timer:start` | none | owner |
| `timer:reset` | none | owner |
| `mod:kick` | `{ userId }` | owner |

Server to client:

| Event | Payload |
| --- | --- |
| `presence:update` | list of `{ userId, name, subject, seatId }` |
| `chat:message` | `{ id, userId, userName, text, createdAt }` |
| `timer:update` | `{ timer: { phase, startedAt, durationMs, endsAt }, serverNow }` |
| `room:kicked` | none |

### REST API

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Sign in |
| GET / PATCH | `/api/auth/me` | Current user, update name or subject |
| GET | `/api/rooms` | Public rooms and your private rooms |
| POST | `/api/rooms` | Create a room |
| POST | `/api/rooms/join` | Join a private room by invite code |
| GET | `/api/rooms/:id` | Room details |

## Replacing the placeholder art

All visuals live in `client/src/components/ClassroomScene.jsx`.

1. Put your `.glb` files in `client/public/models/`.
2. Load them with `useGLTF` from `@react-three/drei` and render them in place of `<Room />` (classroom) or the body in `<Avatar />`.
3. Keep seat positions in `server/src/utils/seats.js` matched to your model's benches. The click targets stay as the invisible/visible bench meshes in `<Seat />`.

Keep the classroom under a few MB (Draco-compressed `.glb`, low poly, baked lighting) so it loads fast on weak laptops and phones.

## Known limitations

- **Single server instance.** Seats, presence and timers live in memory (`roomState.js`). To scale horizontally, move that state to Redis and add the Socket.IO Redis adapter.
- **State resets when a room empties.** Seats and the timer are ephemeral. Chat history and rooms persist in MongoDB.
- **Kicks last for the session.** A removed user can rejoin after the room has been empty (the ban list is in memory).
- **Tokens are in `localStorage`.** Fine for a first version. Consider httpOnly cookies before a public launch.
- No email verification, password reset or message reporting yet.
- Placeholder 3D art, no avatar customisation.

## Roadmap

- [ ] Real classroom and avatar models, sitting animations
- [ ] Avatar customisation (colour, hat) saved to the profile
- [ ] Study-time tracking, streaks and leaderboards
- [ ] Shared to-do list and whiteboard
- [ ] Message reporting, mute, and persistent bans
- [ ] Redis adapter for multiple server instances
- [ ] Voice or video (LiveKit or Daily)

## Troubleshooting

- **`MongoServerSelectionError` on start:** MongoDB is not running or `MONGODB_URI` is wrong.
- **Login works but the room never connects:** make sure the server is running on port 5000, or set `VITE_SOCKET_URL` in production.
- **Blank 3D scene:** check the browser console for WebGL errors and make sure hardware acceleration is on.
- **Can't see an invite code:** only the room owner sees it in the room list.
