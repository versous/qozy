import { getAuth, type Auth } from 'firebase/auth';

import { app, db, isFirebaseConfigured } from './firebaseConfig';

export { db, isFirebaseConfigured };
export const auth: Auth | null = app ? getAuth(app) : null;
export default app;
