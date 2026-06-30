import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Workspace scopes
provider.addScope('https://www.googleapis.com/auth/userinfo.email');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
provider.addScope('https://www.googleapis.com/auth/drive.file');

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory and local storage.
let cachedAccessToken: string | null = null;
try {
  cachedAccessToken = localStorage.getItem('google_drive_access_token');
} catch (e) {
  console.warn('[googleAuth] Failed to load cachedAccessToken from localStorage:', e);
}

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If we don't have an drive access token but have an authenticated user,
        // let them remain logged into the main app instead of forcing a logout.
        if (onAuthSuccess) onAuthSuccess(user, '');
      }
    } else {
      cachedAccessToken = null;
      try {
        localStorage.removeItem('google_drive_access_token');
      } catch (e) {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) {
    console.warn('[googleAuth] Google sign-in is already in progress. Ignoring duplicate call.');
    return null;
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    try {
      localStorage.setItem('google_drive_access_token', cachedAccessToken);
    } catch (e) {}
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (token) {
      localStorage.setItem('google_drive_access_token', token);
    } else {
      localStorage.removeItem('google_drive_access_token');
    }
  } catch (e) {}
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  try {
    localStorage.removeItem('google_drive_access_token');
  } catch (e) {}
};

export function getFirebaseErrorMessage(error: any): string {
  const code = error?.code || '';
  const message = error?.message || '';

  const isPopupError = code.includes('cancelled-popup') || 
                       message.includes('cancelled-popup') || 
                       code.includes('popup-blocked') || 
                       message.includes('popup-blocked') ||
                       code.includes('closed-by-user') ||
                       message.includes('closed-by-user') ||
                       code.includes('popup-closed-by-user');

  if (isPopupError) {
    return 'Google Sign-In popup was blocked, closed, or cancelled. Since this app runs inside an iframe preview, please click the "Open in New Tab" button in the top-right corner of the screen and try again!';
  }

  if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain')) {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'your preview domain';
    return `Unauthorized Domain: The current domain "${hostname}" is not authorized in your Firebase Project configuration. To resolve this, open your Firebase Console at https://console.firebase.google.com/project/mineral-vista-ns6r9/authentication/settings and add "${hostname}" to your "Authorized domains" list under the Settings tab.`;
  }

  if (code === 'auth/operation-not-allowed' || message.includes('operation-not-allowed')) {
    return 'Google Provider Not Enabled: The Google Sign-In provider is disabled in your Firebase project. To resolve this, go to your Firebase Console -> Authentication -> Sign-in method, click "Add new provider", and enable "Google".';
  }

  if (code === 'auth/invalid-api-key' || message.includes('invalid-api-key')) {
    return 'Invalid API Key: The Firebase API key configured in firebase-applet-config.json is invalid. Please double check your Firebase credentials.';
  }

  if (code === 'auth/configuration-not-found' || message.includes('configuration-not-found')) {
    return 'Firebase Config Error: Google Sign-In is not configured correctly in your Firebase project. Please ensure Google Sign-In is fully set up in the Firebase Console.';
  }

  return message || error?.toString() || 'Google Authentication failed.';
}

