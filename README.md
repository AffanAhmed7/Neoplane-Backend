# NeoPlane Backend

This is the production-ready Node.js backend for the **NeoPlane** real-time chat platform.

**Live Demo:** [https://neoplane-frontend.vercel.app/](https://neoplane-frontend.vercel.app/)  
**Frontend Repository:** [https://github.com/AffanAhmed7/neoplane-frontend](https://github.com/AffanAhmed7/neoplane-frontend)

##  Project Overview
The NeoPlane backend powers a highly scalable real-time communication platform. It handles complex social graphs, hierarchical workspaces, real-time event broadcasting, and secure multimedia processing.

##  Backend Features
- **Scalable Socket.io Integration:** Handles room-based broadcasting, precise user presence (Online, Idle, DND, Offline, Custom Status), typing indicators, and instant message delivery.
- **Advanced Authentication & Security:** Hybrid auth supporting Firebase Admin for Google OAuth and bcrypt/jsonwebtoken for custom email/password logins. Protected by Express Rate Limiting and strict schema validation via Zod.
- **Robust Database Architecture:** Leveraging PostgreSQL and Prisma ORM with a highly normalized schema managing polymorphic relationships between users, messages, reactions, read receipts, and friends.
- **Cloud Storage Integration:** Seamless AWS S3 integration utilizing presigned URLs to handle scalable image and file uploads (avatars, banners, attachments) without bottlenecking the server.
- **Advanced Messaging System:** Support for threaded replies, message editing, soft deletions, pinning, full-text search, and granular read receipts.

##  Tech Stack
- **Runtime:** Node.js (Express.js) + TypeScript
- **Database:** PostgreSQL (hosted on Supabase with connection pooling)
- **ORM:** Prisma Client
- **Real-Time Server:** Socket.io
- **Cloud Services:** AWS SDK (S3), Firebase Admin SDK
- **Security & Validation:** bcrypt, jsonwebtoken, express-rate-limit, Zod

##  Setup Instructions
1. Clone this repository.
2. Ensure you have `Node.js` installed.
3. Check the `.env.example` file and create an `.env` file in the root directory with your database and cloud credentials.
4. Install dependencies: `npm install`
5. Synchronize Prisma with your database: `npx prisma db push`
6. (Optional) Start Prisma Studio: `npm run prisma:studio`
7. Start the local development server: `npm run dev`
8. Build for production: `npm run build`

##  Engineering Highlights
- Engineered a scalable relational database design tracking intricate state such as read receipts per user per channel and complex friend/invite workflows.
- Implemented robust error handling and API validation ensuring data integrity before any database interaction.
- Configured secure WebSocket routing (WSS) and restrictive CORS policies suitable for production deployments.
