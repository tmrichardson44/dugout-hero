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

const TARGET_EMAILS = ["tmrichardson@outlook.com", "tmrichardson44@gmail.com"];
const TEAM_NAMES = [
  "The Sandlot Legends", "Field of Dreams", "Home Run Heroes", 
  "Diamond Kings", "Grand Slammers", "Slider Shooters", 
  "Bunt Masters", "Fastball Frenzy", "Eagle Eyes", "Dugout Warriors"
];
const OPPONENTS = ["Red Sox", "Yankees", "Dodgers", "Giants", "Cubs", "Braves", "Astros", "Rays", "Blue Jays", "Mariners"];
const LOCATIONS = ["Field 1", "Field 2", "The Stadium", "Town Park", "West Side Park"];

async function seed() {
  console.log("Starting comprehensive data seed...");
  
  try {
    for (let i = 0; i < 10; i++) {
      const teamName = TEAM_NAMES[i];
      const targetEmail = TARGET_EMAILS[i % TARGET_EMAILS.length];
      
      console.log(`Creating Team ${i + 1}/10: ${teamName} for ${targetEmail}`);
      
      // 1. Create Team
      const teamRef = await addDoc(collection(db, 'saas_data', 'v1', 'teams'), {
        name: teamName,
        program: "Hopkinton Little League",
        managerEmail: targetEmail,
        createdAt: new Date().toISOString(),
        seasonSettings: {
          teamName: teamName,
          rosterSize: 12,
          innings: 6,
          battingTarget: 6.5
        }
      });
      
      const teamId = teamRef.id;
      
      // 2. Create 10 Players
      console.log(`  Adding 10 players to ${teamName}...`);
      const playerPromises = [];
      for (let j = 0; j < 10; j++) {
        playerPromises.push(addDoc(collection(db, 'saas_data', 'v1', 'players'), {
          teamId: teamId,
          name: `Player ${j + 1}`,
          number: (j + 10).toString(),
          avg: parseFloat((6.0 + Math.random()).toFixed(2))
        }));
      }
      await Promise.all(playerPromises);
      
      // 3. Create 10 Games
      console.log(`  Adding 10 games to ${teamName}...`);
      const gamePromises = [];
      for (let k = 0; k < 10; k++) {
        const gameDate = new Date();
        gameDate.setDate(gameDate.getDate() + k);
        const dateStr = `${(gameDate.getMonth() + 1).toString().padStart(2, '0')}/${gameDate.getDate().toString().padStart(2, '0')}/${gameDate.getFullYear()}`;
        
        gamePromises.push(addDoc(collection(db, 'saas_data', 'v1', 'games'), {
          teamId: teamId,
          opponent: OPPONENTS[k % OPPONENTS.length],
          date: dateStr,
          time: "6:00 PM",
          location: LOCATIONS[k % LOCATIONS.length],
          isHome: k % 2 === 0,
          absentPlayerIds: [],
          battingOrder: {},
          field: {},
          createdAt: new Date().toISOString()
        }));
      }
      await Promise.all(gamePromises);
    }
    
    console.log("\nSUCCESS: 10 Teams, 100 Players, and 100 Games created.");
    console.log("NOTE: Manager UIDs will be auto-assigned when you log in to the Pro Dashboard.");
    
  } catch (err) {
    console.error("Seed failed:", err);
  }
  process.exit(0);
}

seed();
