import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// Pega aca tu firebaseConfig desde Firebase Console > Project settings > Your apps.
// Esta config ya queda conectada con Firebase Authentication y Firestore.
const firebaseConfig = {
  apiKey: "AIzaSyC1fEYcvBOJJ8PVixJWVQwS4ikp1yS8pyI",
  authDomain: "doblecero-dbe0e.firebaseapp.com",
  projectId: "doblecero-dbe0e",
  storageBucket: "doblecero-dbe0e.firebasestorage.app",
  messagingSenderId: "328318812763",
  appId: "1:328318812763:web:416dc3e64ff840bb2f757e",
  measurementId: "G-DL033HZLD3"
};

const requiredValues = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId
];

const hasFirebaseConfig = requiredValues.every((value) => value && !String(value).startsWith("PEGAR_"));

let app = null;
let auth = null;
let db = null;

if (hasFirebaseConfig) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db, hasFirebaseConfig };
