# Real-Time Collaborative Code Editor

A full-stack real-time collaborative code editor similar to CodePen/JSFiddle, where multiple users can edit HTML, CSS, and JavaScript simultaneously and see live preview updates with real-time cursor presence.




## Live Application Links

[Frontend Application](https://collab-editor-git-main-raga23mca-cmritacins-projects.vercel.app/)

[Backend API Health Check](https://collab-editor-backend-b1vx.onrender.com/api/health)



---

## Features

- Real-time multi-user code editing
- Live HTML, CSS, and JavaScript preview using sandboxed iframe
- Collaborative cursors with user-specific colors
- Active users presence indicator
- Auto-save every 30 seconds
- JWT-based authentication
- Fork and share snippets
- Dark mode support
- Keyboard shortcuts (Ctrl + S to save)

 Backend
- REST APIs built with Express
- Real-time communication using Socket.IO
- Redis for active sessions and user presence
- MongoDB for persistent storage
- Rate limiting to prevent abuse
- Debounced real-time updates for performance

frontend
- React with TypeScript
- Monaco Editor for code editing
- Responsive split-pane editor layout

---

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Monaco Editor
- Socket.IO Client
- Tailwind CSS

### Backend
- Node.js
- Express
- TypeScript
- MongoDB (Mongoose)
- Redis
- Socket.IO
- JWT Authentication

---

## Architecture Overview
Browser (React + Monaco Editor)
|
| REST APIs (JWT Authentication)
v
Express Server ---- MongoDB (Users, Snippets)
|
| Socket.IO
v
Redis (Active sessions, cursors, presence)

- One Socket.IO room per snippet
- Redis stores live code state and connected users
- MongoDB persists snippets automatically every 30 seconds

---


---

## Backend API Endpoints

### Authentication
- POST /api/auth/register – Register a new user
- POST /api/auth/login – Login user and receive JWT

### Snippets
- POST /api/snippets – Create a new snippet
- GET /api/snippets/:id – Get snippet and increment view count
- PUT /api/snippets/:id – Update snippet (authentication required)
- DELETE /api/snippets/:id – Delete snippet
- POST /api/snippets/:id/fork – Fork an existing snippet
- GET /api/snippets – List public snippets with pagination

---

## Socket.IO Events

### Client to Server
- join-snippet
- code-change
- cursor-move
- leave-snippet

### Server to Client
- user-joined
- user-left
- code-updated
- cursor-updated
- active-users

---

## Frontend Pages

- /login – User login
- /register – User registration
- /explore – Browse public snippets
- /editor/:snippetId – Collaborative code editor

---

## Testing Checklist

- Open the editor in two browser windows
- Both users edit simultaneously
- Code changes appear in real time
- Cursors sync correctly across users
- Live preview updates properly
- Disconnecting and reconnecting restores session
- Forking creates a new snippet

---

## Known Limitations

- Uses Last-Write-Wins strategy for conflict resolution
- Not optimized for more than 10 concurrent users per snippet
- External resources are restricted in the preview iframe

---

## Setup Instructions

1. Clone the Repository
git clone https://github.com/Rajendrank28/collab-editor.git
cd collab-editor

2. Backend Setup
cd backend
npm install
cp .env.example .env
npm run dev

3. Frontend Setup
cd frontend
npm install
cp .env.example .env
npm run dev

Environment Variables

Backend .env.example
PORT=5000
MONGO_URI=mongodb://localhost:27017/your_database_name
JWT_SECRET=your_jwt_secret_here
REDIS_URL=redis://localhost:6379

Frontend .env.example
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000

Deployment
Frontend deployed on Vercel
Backend deployed on Render
MongoDB Atlas used for database
Redis Cloud or Upstash for Redis

