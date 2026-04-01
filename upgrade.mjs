import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";

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

async function upgradeUser() {
  const usersRef = collection(db, "users");
  const snapshot = await getDocs(usersRef);
  
  let updated = false;
  for (const d of snapshot.docs) {
    const data = d.data();
    if (data.email && data.email.toLowerCase() === 'tmrichardson44@gmail.com') {
      console.log(`Found user ${d.id} (${data.email}). Current role: ${data.systemRole}`);
      await updateDoc(doc(db, "users", d.id), {
        systemRole: 'super_admin',
        isAdmin: true // extra fallback
      });
      console.log("Forced systemRole: 'super_admin'");
      updated = true;
    }
  }

  if (!updated) console.log("Did not find any user with that email!");
  process.exit(0);
}

upgradeUser().catch(err => {
  console.error(err);
  process.exit(1);
});
