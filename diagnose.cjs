const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

async function run() {
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log('--- USERS ---');
  usersSnap.forEach(d => console.log(d.id, d.data().email, d.data().uid));

  const leaguesSnap = await getDocs(collection(db, 'saas_data', 'v1', 'leagues'));
  console.log('\n--- LEAGUES ---');
  leaguesSnap.forEach(d => console.log(d.id, d.data().name, 'admin:', d.data().adminUid));

  const divisionsSnap = await getDocs(collection(db, 'saas_data', 'v1', 'divisions'));
  console.log('\n--- DIVISIONS ---');
  divisionsSnap.forEach(d => console.log(d.id, d.data().name, 'league:', d.data().leagueId, 'admin:', d.data().adminUid, d.data().adminEmail));

  const teamsSnap = await getDocs(collection(db, 'saas_data', 'v1', 'teams'));
  console.log('\n--- TEAMS ---');
  teamsSnap.forEach(d => console.log(d.id, d.data().name, 'league:', d.data().leagueId, 'div:', d.data().divisionId, 'mgr:', d.data().managerUid, 'coachEmail:', d.data().coachEmail));

  process.exit(0);
}
run();
