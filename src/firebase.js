import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD4SqFZTr-4C9xRhJI684fXEl8nSrB-e90",
  authDomain: "dugouthero-27584.firebaseapp.com",
  projectId: "dugouthero-27584",
  storageBucket: "dugouthero-27584.firebasestorage.app",
  messagingSenderId: "476431764415",
  appId: "1:476431764415:web:dce540fc1fc079d96f6f0a",
  measurementId: "G-ZRFQ6L4P3Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

import { getAuth } from "firebase/auth";
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);
