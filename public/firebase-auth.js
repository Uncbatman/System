import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc, getFirestore, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyDJC4uoJtJXGkJOA4XG5IejQHKt3FtI60Q',
  authDomain: 'workraft-level-up.firebaseapp.com',
  projectId: 'workraft-level-up',
  storageBucket: 'workraft-level-up.firebasestorage.app',
  messagingSenderId: '456639194402',
  appId: '1:456639194402:web:e858d700eab0f7b1a3717b',
});
const auth = getAuth(app);
const db = getFirestore(app);

window.fb = {
  signIn: () => signInWithPopup(auth, new GoogleAuthProvider()),
  out: () => signOut(auth),
  get: async user => (await getDoc(doc(db, 'users', user.uid))).data(),
  set: (user, value) => setDoc(doc(db, 'users', user.uid), value),
};

onAuthStateChanged(auth, user => window.onUser?.(user));
