import * as admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID?.replace(/"/g, '').trim();
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.replace(/"/g, '').trim();
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, '').trim();

if (!projectId || !clientEmail || !privateKey) {
  console.warn('Firebase Admin credentials are not fully configured. Google Auth will not work.');
} else {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log('Firebase Admin initialized successfully');
  }
}

export default admin;
