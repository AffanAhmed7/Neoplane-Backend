# NeoPlane Backend

This is the production-ready Node.js backend for the **NeoPlane** real-time chat platform. 

## Features
- Scalable Socket.io Integration (Presence, Typing, Chat, Notifications)
- Advanced JWT Authentication & Security
- Rate-Limiting & Request Throttling
- AWS S3 Seamless Image Uploads
- PostgreSQL + Prisma DB
- Full-Text Message & Global User Search

## Setup
1. Clone the repository.
2. Ensure you have `Node.js` installed.
3. Check the `.env.example` file and create an `.env` file in the root directory.
4. Run `npm install`.
5. Run `npx prisma db push` to synchronize changes to your database.
6. Run `npm run dev` to start the local development server.
