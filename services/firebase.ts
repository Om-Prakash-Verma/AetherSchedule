import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

/**
 * FIREBASE CONFIGURATION
 */
const firebaseConfig = {
  apiKey: "AIzaSyDVP2-iG4HD-oheVyXXJqNLHWUL9FUT448",
  authDomain: "timetable-2cb72.firebaseapp.com",
  projectId: "timetable-2cb72",
  storageBucket: "timetable-2cb72.firebasestorage.app",
  messagingSenderId: "757693148932",
  appId: "1:757693148932:web:c1141ad06967f9b1d52a51",
  measurementId: "G-73N12Q1JJW"
};

// Initialize Firebase
let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

try {
    app = initializeApp(firebaseConfig);
    // getFirestore connects to the default app instance
    db = getFirestore(app);
    auth = getAuth(app);
} catch (error) {
    console.error("Firebase initialization failed:", error);
}

export { db, auth };