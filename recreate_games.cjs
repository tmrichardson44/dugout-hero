const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, where } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');

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
const auth = getAuth(app);

const COACH_UID = 'PXuoGaGnQugDms8ZaoYl1C0Ge673';
const COACH_EMAIL = 'coach_user@test.com';

const OPPONENTS = ["Red Sox", "Yankees", "Dodgers", "Giants", "Cubs", "Braves", "Astros", "Rays", "Blue Jays", "Mariners"];
const LOCATIONS = ["Field 1", "Field 2", "The Stadium", "Town Park", "West Side Park"];
const GAMES = [
  { opponent: "Red Sox",    date: "Apr 5",  time: "10:00 AM", location: "Field 1",  isHome: true  },
  { opponent: "Yankees",    date: "Apr 12", time: "12:00 PM", location: "Field 2",  isHome: false },
  { opponent: "Cubs",       date: "Apr 19", time: "10:00 AM", location: "Field 1",  isHome: true  },
  { opponent: "Dodgers",    date: "Apr 26", time: "1:00 PM",  location: "Field 3",  isHome: false },
  { opponent: "Braves",     date: "May 3",  time: "10:00 AM", location: "Field 1",  isHome: true  },
  { opponent: "Mets",       date: "May 10", time: "11:00 AM", location: "Field 4",  isHome: false },
  { opponent: "Cardinals",  date: "May 17", time: "10:00 AM", location: "Field 1",  isHome: true  },
  { opponent: "Phillies",   date: "May 24", time: "12:00 PM", location: "Field 2",  isHome: true  },
  { opponent: "Giants",     date: "May 31", time: "10:00 AM", location: "Field 5",  isHome: false },
  { opponent: "Astros",     date: "Jun 7",  time: "1:00 PM",  location: "Field 1",  isHome: true  },
];

async function authenticate() {
  const tempEmail = 'temp_seed_12345@test.com';
  const tempPassword = 'password123';
  try {
    await signInWithEmailAndPassword(auth, tempEmail, tempPassword);
    console.log('Authentication successful');
  } catch (error) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      try {
        await createUserWithEmailAndPassword(auth, tempEmail, tempPassword);
        console.log('Created and authenticated temp user');
      } catch (createError) {
        throw new Error('Failed to create temp user: ' + createError.message);
      }
    } else {
      throw error;
    }
  }
}

async function run() {
  console.log("Starting to update teams and recreate games...");
  try {
    await authenticate();
    
    const teamsRef = collection(db, 'saas_data', 'v1', 'teams');
    const teamsSnap = await getDocs(teamsRef);
    
    console.log(`Found ${teamsSnap.size} teams. Processing...`);

    for (const teamDoc of teamsSnap.docs) {
      const teamId = teamDoc.id;
      const teamName = teamDoc.data().name;
      
      console.log(`Updating Team: ${teamName} (${teamId})`);
      await updateDoc(doc(db, 'saas_data', 'v1', 'teams', teamId), {
        managerUid: COACH_UID,
        managerEmail: COACH_EMAIL
      });

      // Delete existing games for this team
      const gamesQ = query(collection(db, 'saas_data', 'v1', 'games'), where('teamId', '==', teamId));
      const gamesSnap = await getDocs(gamesQ);
      for (const gameDoc of gamesSnap.docs) {
        await deleteDoc(doc(db, 'saas_data', 'v1', 'games', gameDoc.id));
      }
      console.log(`  Deleted ${gamesSnap.size} existing games.`);

      // Create 10 games
      const gamePromises = [];
      for (const g of GAMES) {
        gamePromises.push(addDoc(collection(db, 'saas_data', 'v1', 'games'), {
          ...g,
          id: Date.now() + Math.floor(Math.random() * 10000),
          teamId: teamId,
          absentPlayerIds: [],
          battingOrder: {},
          field: {},
          createdAt: new Date().toISOString()
        }));
      }
      await Promise.all(gamePromises);
      console.log(`  Created 10 games for ${teamName}.`);
    }

    console.log("SUCCESS: Recreated games and assigned all teams to coach_user@test.com.");
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

run();
