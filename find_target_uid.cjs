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

async function getUid() {
  const email = 'tmrichardson@outlook.com';
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  if (!snap.empty) {
    console.log(`UID_FOUND:${snap.docs[0].id}`);
  } else {
    // Try gmail as fallback
    const q2 = query(collection(db, 'users'), where('email', '==', 'tmrichardson44@gmail.com'));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
        console.log(`UID_FOUND:${snap2.docs[0].id}`);
    } else {
        console.log('UID_NOT_FOUND');
    }
  }
  process.exit(0);
}

getUid().catch(err => {
  console.error(err);
  process.exit(1);
});
