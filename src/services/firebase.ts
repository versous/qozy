import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Remplacer ces valeurs par vos propres clés Firebase
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-app",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// Export des services pour être utilisés dans toute l'app
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
