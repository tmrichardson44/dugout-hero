import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updatePassword,
  deleteUser,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signup(email, password, displayName) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create the standard Pro user document in Firestore on signup
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: displayName,
      systemRole: 'user',
      createdAt: serverTimestamp()
    });
    
    return userCredential;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Create user doc if it doesn't exist yet (first Google sign-in)
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Google User',
        systemRole: 'user',
        createdAt: serverTimestamp()
      });
    }

    return result;
  }

  function logout() {
    return signOut(auth);
  }

  function changePassword(newPassword) {
    return updatePassword(auth.currentUser, newPassword);
  }

  function deleteAccount() {
    return deleteUser(auth.currentUser);
  }

  function isSuperAdmin() {
    return currentUser?.systemRole === 'super_admin';
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch supplemental user data (systemRole, etc.)
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          // Backwards compat: map old isAdmin:true → systemRole:super_admin
          const systemRole = data.systemRole || (data.isAdmin ? 'super_admin' : 'user');
          setCurrentUser({ ...user, ...data, systemRole });
        } else {
           // Auto-heal missing user documents from legacy sessions
           const defaultRole = user.email === 'tmrichardson44@gmail.com' ? 'super_admin' : 'user';
           await setDoc(doc(db, 'users', user.uid), {
             uid: user.uid,
             email: user.email,
             displayName: user.displayName || null,
             systemRole: defaultRole,
             createdAt: serverTimestamp()
           });
           setCurrentUser({ ...user, systemRole: defaultRole, displayName: user.displayName });
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    login,
    signup,
    loginWithGoogle,
    logout,
    changePassword,
    deleteAccount,
    isSuperAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
