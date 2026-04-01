const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

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

const LEAGUE_ADMIN_UID = 'vUiDeCB44MXIVNRt7SqQV32r1Fz1';
const DIVISION_ADMIN_UID = 'SbEilYxapSeT8v5DiwhbWjLhSS33';
const COACH_USER_UID = 'PXuoGaGnQugDms8ZaoYl1C0Ge673';

async function setup() {
  try {
    // 1. Create League
    const leagueRef = await addDoc(collection(db, 'saas_data', 'v1', 'leagues'), {
      name: 'Test Alpha League',
      program: 'Hopkinton Little League',
      adminUid: LEAGUE_ADMIN_UID,
      createdAt: serverTimestamp()
    });
    console.log('Created League:', leagueRef.id);

    // 2. Create Division
    const divisionRef = await addDoc(collection(db, 'saas_data', 'v1', 'divisions'), {
      name: 'Test Beta Division',
      leagueId: leagueRef.id,
      adminUid: DIVISION_ADMIN_UID,
      adminEmail: 'division_admin@test.com',
      createdAt: serverTimestamp()
    });
    console.log('Created Division:', divisionRef.id);

    // 3. Create Team
    const teamRef = await addDoc(collection(db, 'saas_data', 'v1', 'teams'), {
      name: 'Test Gamma Team',
      leagueId: leagueRef.id,
      divisionId: divisionRef.id,
      managerUid: COACH_USER_UID,
      program: 'Hopkinton Little League',
      createdAt: serverTimestamp(),
      seasonSettings: {
        teamName: 'Test Gamma Team',
        rosterSize: 12,
        innings: 6,
        battingTarget: 6.5
      }
    });
    console.log('Created Team:', teamRef.id);

    console.log('Setup complete!');
  } catch (err) {
    console.error('Setup failed:', err);
  }
  process.exit(0);
}

setup();
