import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyBp3QTOLvsro8blyhqevJ2m5mvBRmCHIBQ",
  authDomain: "johnny-blaze-taller.firebaseapp.com",
  projectId: "johnny-blaze-taller",
  storageBucket: "johnny-blaze-taller.firebasestorage.app",
  messagingSenderId: "232058529168",
  appId: "1:232058529168:web:5b6a67dd3c2f1ff9143f15",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Persistencia IndexedDB: las escrituras se encolan offline y sincronizan al volver la conexión
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const functions = getFunctions(app);
export default app;
