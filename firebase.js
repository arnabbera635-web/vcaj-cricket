import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, query, orderBy, limit, onSnapshot, serverTimestamp, increment, runTransaction } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAILS } from "./firebase-config.js";
const app=initializeApp(firebaseConfig);
export const auth=getAuth(app); export const db=getFirestore(app);
export {collection,doc,getDoc,getDocs,setDoc,updateDoc,addDoc,deleteDoc,query,orderBy,limit,onSnapshot,serverTimestamp,increment,runTransaction,signInWithEmailAndPassword,signOut,onAuthStateChanged,ADMIN_EMAILS};
export function isAdmin(user){return !!user && ADMIN_EMAILS.map(x=>x.toLowerCase()).includes((user.email||"").toLowerCase());}