// Firebase configuration for Kedai Hawa.
// Replace the values below with your Firebase Web App configuration.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, where, getDocs
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  getAuth, signInAnonymously, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCxE1sZw3CBV8A71hkfdnGNTr7P1pEU5Q",
  authDomain: "kedai-hawa.firebaseapp.com",
  projectId: "kedai-hawa",
  storageBucket: "kedai-hawa.firebasestorage.app",
  messagingSenderId: "237267777888",
  appId: "1:237267777888:web:6a1dec04d2e8a255e14605"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export {
  app, db, auth,
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, where, getDocs,
  signInAnonymously, signInWithEmailAndPassword, onAuthStateChanged, signOut,
  getMessaging, getToken, onMessage, isSupported
};
