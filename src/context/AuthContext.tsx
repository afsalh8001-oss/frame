import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { createUserProfileAtomic, normalizeUsername } from '../lib/userService';
import { PendingRegistration, UserProfile } from '../types/user';

const PENDING_REG_KEY_PREFIX = 'frame_pending_reg_';

function savePendingRegistration(uid: string, data: PendingRegistration): void {
  try {
    localStorage.setItem(`${PENDING_REG_KEY_PREFIX}${uid}`, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPendingRegistration(uid: string): PendingRegistration | null {
  try {
    const raw = localStorage.getItem(`${PENDING_REG_KEY_PREFIX}${uid}`);
    if (!raw) return null;
    return JSON.parse(raw) as PendingRegistration;
  } catch {
    return null;
  }
}

export function clearPendingRegistration(uid: string): void {
  try {
    localStorage.removeItem(`${PENDING_REG_KEY_PREFIX}${uid}`);
  } catch {
    // Ignore
  }
}

export function formatAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment before trying again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in the Firebase Console for this project. Enable it under Authentication > Sign-in method, or continue with Google.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    default:
      return err instanceof Error ? err.message : 'Authentication failed. Please try again.';
  }
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  authReady: boolean;
  profileLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (params: {
    email: string;
    password: string;
    displayName: string;
    username: string;
  }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
      } else {
        setProfileLoading(true);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const path = `users/${firebaseUser.uid}`;
    const userDocRef = doc(db, 'users', firebaseUser.uid);

    const unsubscribe = onSnapshot(
      userDocRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          clearPendingRegistration(firebaseUser.uid);
          setProfile(snapshot.data() as UserProfile);
          setProfileLoading(false);
          return;
        }

        // If user just verified email and we have a pending registration saved, create profile atomically
        if (firebaseUser.emailVerified) {
          const pending = loadPendingRegistration(firebaseUser.uid);
          if (pending) {
            try {
              await createUserProfileAtomic({
                uid: firebaseUser.uid,
                username: pending.username,
                displayName: pending.displayName,
                bio: '',
                photoURL: firebaseUser.photoURL ?? '',
                isPrivate: false,
              });
              clearPendingRegistration(firebaseUser.uid);
              return;
            } catch {
              // If username was taken while verifying, fall through to Onboarding screen
              clearPendingRegistration(firebaseUser.uid);
            }
          }
        }

        setProfile(null);
        setProfileLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return unsubscribe;
  }, [authReady, firebaseUser]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUpWithEmail = useCallback(
    async ({
      email,
      password,
      displayName,
      username,
    }: {
      email: string;
      password: string;
      displayName: string;
      username: string;
    }) => {
      const normalized = normalizeUsername(username);
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, {
        displayName: displayName.trim(),
      });
      savePendingRegistration(cred.user.uid, {
        username: normalized,
        displayName: displayName.trim(),
      });
      await sendEmailVerification(cred.user);
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) {
      throw new Error('No signed-in user.');
    }
    await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshVerificationStatus = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    if (refreshed.emailVerified) {
      setFirebaseUser({ ...refreshed } as User);
      const pending = loadPendingRegistration(refreshed.uid);
      if (pending) {
        try {
          await createUserProfileAtomic({
            uid: refreshed.uid,
            username: pending.username,
            displayName: pending.displayName,
            bio: '',
            photoURL: refreshed.photoURL ?? '',
            isPrivate: false,
          });
          clearPendingRegistration(refreshed.uid);
        } catch {
          clearPendingRegistration(refreshed.uid);
        }
      }
      return true;
    }
    return false;
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        authReady,
        profileLoading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        sendPasswordReset,
        resendVerificationEmail,
        refreshVerificationStatus,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
