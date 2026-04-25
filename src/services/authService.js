import { auth } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";

export function escucharAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
