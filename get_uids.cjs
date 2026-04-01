const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyD4SqFZTr-4C9xRhJI684fXEl8nSrB-e90",
  authDomain: "dugouthero-27584.firebaseapp.com",
  projectId: "dugouthero-27584",
  storageBucket: "dugouthero-27584.firebasestorage.app",
  messagingSenderId: "476431764415",
  appId: "1:476431764415:web:dce540fc1fc079d96f6f0a",
  measurementId: "G-ZRFQ6L4P3Q"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function getUids() {
  const emails = ['league_admin@test.com', 'division_admin@test.com', 'coach_user@test.com'];
  for (const email of emails) {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snap = await getDocs(q);
    if (!snap.empty) {
      console.log(`${email}: ${snap.docs[0].id}`);
    } else {
      console.log(`${email}: NOT FOUND`);
    }
  }
  process.exit(0);
}

getUids().catch(err => {
  console.error(err);
  process.exit(1);
});
