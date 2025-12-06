import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

/**
 * FIREBASE CONFIGURATION
 */
const firebaseConfig = {
  apiKey: "AIzaSyCN2oMFOvxH0qf_choZErha8b1d3hdoQms",
  authDomain: "studio-3385987927-3a42b.firebaseapp.com",
  projectId: "studio-3385987927-3a42b",
  storageBucket: "studio-3385987927-3a42b.firebasestorage.app",
  messagingSenderId: "869264912126",
  appId: "1:869264912126:web:34b9bc097be73636ef3faf"
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
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization failed:", error);
}

export { db, auth };