
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import 'firebase/compat/functions';

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
let app;
let db: firebase.firestore.Firestore | undefined;
let auth: firebase.auth.Auth | undefined;
let functions: firebase.functions.Functions | undefined;

try {
    if (!firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
    } else {
        app = firebase.app();
    }
    
    db = app.firestore();
    auth = app.auth();
    functions = app.functions();

    // Uncomment to use local emulator during development
    // db.useEmulator("localhost", 8080);
    // functions.useEmulator("localhost", 5001);
    // auth.useEmulator("http://localhost:9099");

    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization failed:", error);
}

export { db, auth, functions };
export default app;
