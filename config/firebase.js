// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { initializeFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB3-n3WIdEOhCxvpbigs_ogse7b3tggGGU",
  authDomain: "insightflow-82cc4.firebaseapp.com",
  projectId: "insightflow-82cc4",
  storageBucket: "insightflow-82cc4.firebasestorage.app",
  messagingSenderId: "945960175733",
  appId: "1:945960175733:web:70345b9cf08a553db2d03c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
/** Long polling reduz falhas WebChannel (404 / transport errored) em alguns provedores e proxies. */
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true
});
export const storage = getStorage(app);

console.log('🔥 Firebase inicializado com sucesso!');

