import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
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

if (import.meta.env.VITE_USE_EMULATOR === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export default app;
