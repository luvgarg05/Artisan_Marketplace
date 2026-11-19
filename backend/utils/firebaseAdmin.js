import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Verifying a Firebase ID token only needs the project ID (Google's public
// signing keys are fetched automatically), so no service-account file is required.
function getFirebaseAuth() {
  if (!getApps().length) {
    if (!process.env.FIREBASE_PROJECT_ID) {
      throw new Error("FIREBASE_PROJECT_ID is not set in the environment.");
    }
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  }
  return getAuth();
}

// Confirms the client really completed phone OTP verification for `phone`
// (a 10-digit Indian number, as stored in the database).
export async function verifyPhoneOwnership(firebaseToken, phone) {
  if (!firebaseToken) return false;
  try {
    const decoded = await getFirebaseAuth().verifyIdToken(firebaseToken);
    return decoded.phone_number === `+91${phone}`;
  } catch (err) {
    console.error("Firebase token verification failed:", err.message);
    return false;
  }
}
