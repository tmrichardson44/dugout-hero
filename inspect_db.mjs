import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

async function inspect() {
  console.log("--- LEAGUES ---");
  const leagues = await getDocs(collection(db, "saas_data", "v1", "leagues"));
  leagues.forEach(doc => console.log(doc.id, "=>", doc.data()));

  console.log("\n--- TEAMS ---");
  const teams = await getDocs(collection(db, "saas_data", "v1", "teams"));
  teams.forEach(doc => console.log(doc.id, "=>", doc.data()));

  process.exit(0);
}

inspect().catch(console.error);
