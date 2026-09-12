"use strict";
/*
  Fill this in with your real Firebase project's config (Project settings → General →
  Your apps → SDK setup and configuration) and flip FIREBASE_ENABLED to true once the
  project has Google, Apple, Facebook, and Email/Password sign-in enabled under
  Authentication → Sign-in method, and a Firestore database created.

  Until then FIREBASE_ENABLED stays false and the app runs entirely on the local
  "Continue as Guest" / local-email path (see auth.js) so everything else — avatar,
  mode select, ads, paywall, Scoreboard Mode — is fully testable without a backend.
*/
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
const FIREBASE_ENABLED = false;

let fbApp = null, fbAuth = null, fbDb = null, fbAuthMod = null, fbFsMod = null;
let firebaseReady = null; // Promise, set by initFirebase()

function initFirebase(){
  if(!FIREBASE_ENABLED){ firebaseReady = Promise.resolve(false); return firebaseReady; }
  firebaseReady = (async () => {
    try{
      const [{ initializeApp }, authMod, fsMod] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
      ]);
      fbApp = initializeApp(FIREBASE_CONFIG);
      fbAuth = authMod.getAuth(fbApp);
      fbDb = fsMod.getFirestore(fbApp);
      fbAuthMod = authMod; fbFsMod = fsMod;
      return true;
    }catch(e){
      console.error('Firebase init failed — falling back to guest mode', e);
      return false;
    }
  })();
  return firebaseReady;
}
