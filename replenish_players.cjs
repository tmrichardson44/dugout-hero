const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, query, where } = require('firebase/firestore');

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

const PLAYER_NAMES = [
  "Ace Ventura", "Babe Ruthless", "Cal Ripken Jr.", "Derek Jitter", 
  "Shohei Ohtani", "Mookie Betts", "Mike Trout", "Aaron Judge", 
  "Trea Turner", "Freddie Freeman", "Ronald Acuna", "Juan Soto"
];

async function replenish() {
  console.log("Replenishing rosters for 10-player minimum...");
  
  try {
    const teamsSnap = await getDocs(collection(db, 'saas_data', 'v1', 'teams'));
    console.log(`Found ${teamsSnap.size} teams.`);
    
    for (const teamDoc of teamsSnap.docs) {
      const teamId = teamDoc.id;
      const teamData = teamDoc.data();
      
      // Check current player count
      const playersSnap = await getDocs(query(collection(db, 'saas_data', 'v1', 'players'), where("teamId", "==", teamId)));
      const currentCount = playersSnap.size;
      
      if (currentCount < 10) {
        const needed = 10 - currentCount;
        console.log(`Team "${teamData.name}" (${teamId}) has ${currentCount} players. Adding ${needed} more...`);
        
        for (let i = 0; i < needed; i++) {
          const pId = Date.now() + Math.floor(Math.random() * 1000000);
          const name = PLAYER_NAMES[i % PLAYER_NAMES.length];
          const number = (20 + i + currentCount).toString();
          
          await addDoc(collection(db, 'saas_data', 'v1', 'players'), {
            id: pId,
            teamId: teamId,
            name: `${name} ${currentCount + i + 1}`,
            number: number,
            bats: i % 3 === 0 ? "L" : "R",
            throws: i % 4 === 0 ? "L" : "R",
            willPitch: i % 3 === 0, // Approx 1 in 3 can pitch
            willCatch: i % 5 === 0, // Approx 1 in 5 can catch
            avg: parseFloat((5.5 + Math.random() * 2).toFixed(2))
          });
        }
      } else {
        console.log(`Team "${teamData.name}" already has ${currentCount} players.`);
      }
    }
    
    console.log("\nSUCCESS: All teams verified to have 10+ players.");
  } catch (err) {
    console.error("Replenish failed:", err);
  }
  process.exit(0);
}

replenish();
