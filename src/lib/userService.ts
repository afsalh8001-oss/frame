import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from './firebase';
import { BLUEPRINT_LIMITS, UserProfile } from '../types/user';

export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, BLUEPRINT_LIMITS.USERNAME_MAX);
}

export function suggestUsername(seed: string, uid: string): string {
  const cleaned = normalizeUsername(seed).replace(/^_+|_+$/g, '');
  const suffix = uid.slice(0, 4).toLowerCase().replace(/[^a-z0-9]/g, '0');
  if (cleaned.length >= BLUEPRINT_LIMITS.USERNAME_MIN) {
    return cleaned.slice(0, BLUEPRINT_LIMITS.USERNAME_MAX);
  }
  const base = cleaned || 'user';
  return `${base}_${suffix}`.slice(0, BLUEPRINT_LIMITS.USERNAME_MAX);
}

export function validateUsernameFormat(username: string): string | null {
  if (!username) {
    return 'Username is required.';
  }
  if (username.length < BLUEPRINT_LIMITS.USERNAME_MIN) {
    return `Username must be at least ${BLUEPRINT_LIMITS.USERNAME_MIN} characters.`;
  }
  if (username.length > BLUEPRINT_LIMITS.USERNAME_MAX) {
    return `Username must be ${BLUEPRINT_LIMITS.USERNAME_MAX} characters or fewer.`;
  }
  if (!BLUEPRINT_LIMITS.USERNAME_PATTERN.test(username)) {
    return 'Use only lowercase letters, numbers, and underscores.';
  }
  return null;
}

export function validateDisplayName(displayName: string): string | null {
  const trimmed = displayName.trim();
  if (trimmed.length < BLUEPRINT_LIMITS.DISPLAY_NAME_MIN) {
    return 'Display name is required.';
  }
  if (trimmed.length > BLUEPRINT_LIMITS.DISPLAY_NAME_MAX) {
    return `Display name must be ${BLUEPRINT_LIMITS.DISPLAY_NAME_MAX} characters or fewer.`;
  }
  return null;
}

export function validateBio(bio: string): string | null {
  if (bio.length > BLUEPRINT_LIMITS.BIO_MAX) {
    return `Bio must be ${BLUEPRINT_LIMITS.BIO_MAX} characters or fewer.`;
  }
  return null;
}

function sanitizePhotoURL(photoURL: string): string {
  const trimmed = photoURL.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('https://')) return '';
  return trimmed.slice(0, BLUEPRINT_LIMITS.PHOTO_URL_MAX);
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const formatError = validateUsernameFormat(username);
  if (formatError) return false;

  const path = `usernames/${username}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', username));
    return !snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  const normalized = normalizeUsername(username);
  if (validateUsernameFormat(normalized)) return null;

  const usernamePath = `usernames/${normalized}`;
  try {
    const reservationSnap = await getDoc(doc(db, 'usernames', normalized));
    if (!reservationSnap.exists()) return null;
    const { uid } = reservationSnap.data() as { uid: string };
    return await getUserProfile(uid);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, usernamePath);
  }
}

export async function listPublicProfiles(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const q = query(
      collection(db, 'users'),
      where('isPrivate', '==', false),
      limit(24)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function searchUsersByUsernamePrefix(rawPrefix: string): Promise<UserProfile[]> {
  const prefix = rawPrefix.trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]/g, '');
  if (!prefix) return [];

  const path = 'users';
  try {
    const q = query(
      collection(db, 'users'),
      where('isPrivate', '==', false),
      where('username', '>=', prefix),
      where('username', '<=', `${prefix}\uf8ff`),
      orderBy('username'),
      limit(15)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    // Graceful fallback if composite index (isPrivate, username) is not created yet
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('index') || msg.includes('failed-precondition')) {
      try {
        const fallbackSnap = await getDocs(
          query(collection(db, 'users'), where('isPrivate', '==', false), limit(50))
        );
        return fallbackSnap.docs
          .map((d) => d.data() as UserProfile)
          .filter((u) => u.username.startsWith(prefix))
          .slice(0, 15);
      } catch (fallbackErr) {
        handleFirestoreError(fallbackErr, OperationType.LIST, path);
      }
    }
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export interface CreateProfileInput {
  uid: string;
  username: string;
  displayName: string;
  bio?: string;
  photoURL?: string;
  isPrivate?: boolean;
}

export async function createUserProfileAtomic(input: CreateProfileInput): Promise<void> {
  const username = normalizeUsername(input.username);
  const usernameErr = validateUsernameFormat(username);
  if (usernameErr) throw new Error(usernameErr);

  const displayName = input.displayName.trim().slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX);
  const nameErr = validateDisplayName(displayName);
  if (nameErr) throw new Error(nameErr);

  const bio = (input.bio ?? '').trim().slice(0, BLUEPRINT_LIMITS.BIO_MAX);
  const photoURL = sanitizePhotoURL(input.photoURL ?? '');

  const available = await isUsernameAvailable(username);
  if (!available) {
    throw new Error(`The username @${username} is already taken.`);
  }

  const batch = writeBatch(db);
  const userRef = doc(db, 'users', input.uid);
  const usernameRef = doc(db, 'usernames', username);

  batch.set(userRef, {
    uid: input.uid,
    username,
    displayName,
    bio,
    photoURL,
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    isPrivate: Boolean(input.isPrivate),
    createdAt: serverTimestamp(),
  });

  batch.set(usernameRef, {
    uid: input.uid,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${input.uid}`);
  }
}

export interface UpdateProfileInput {
  uid: string;
  currentUsername: string;
  nextUsername: string;
  displayName: string;
  bio: string;
  photoURL: string;
  isPrivate: boolean;
}

async function syncPostsAuthorMetadata(
  uid: string,
  username: string,
  photoURL: string,
  isPrivate: boolean
): Promise<void> {
  try {
    const postsSnap = await getDocs(
      query(collection(db, 'posts'), where('authorId', '==', uid), limit(200))
    );
    if (postsSnap.empty) return;
    const batch = writeBatch(db);
    postsSnap.docs.forEach((postDoc) => {
      batch.update(postDoc.ref, {
        authorUsername: username,
        authorPhotoURL: photoURL,
        authorIsPrivate: isPrivate,
      });
    });
    await batch.commit();
  } catch {
    // Non-fatal background sync
  }
}

export async function updateUserProfileAtomic(input: UpdateProfileInput): Promise<void> {
  const nextUsername = normalizeUsername(input.nextUsername);
  const usernameErr = validateUsernameFormat(nextUsername);
  if (usernameErr) throw new Error(usernameErr);

  const displayName = input.displayName.trim().slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX);
  const nameErr = validateDisplayName(displayName);
  if (nameErr) throw new Error(nameErr);

  const bio = input.bio.trim().slice(0, BLUEPRINT_LIMITS.BIO_MAX);
  const bioErr = validateBio(bio);
  if (bioErr) throw new Error(bioErr);

  const photoURL = sanitizePhotoURL(input.photoURL);
  const userRef = doc(db, 'users', input.uid);

  if (nextUsername === input.currentUsername) {
    try {
      await updateDoc(userRef, {
        displayName,
        bio,
        photoURL,
        isPrivate: input.isPrivate,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${input.uid}`);
    }
    await syncPostsAuthorMetadata(input.uid, nextUsername, photoURL, input.isPrivate);
    return;
  }

  const available = await isUsernameAvailable(nextUsername);
  if (!available) {
    throw new Error(`The username @${nextUsername} is already taken.`);
  }

  const batch = writeBatch(db);
  batch.delete(doc(db, 'usernames', input.currentUsername));
  batch.set(doc(db, 'usernames', nextUsername), {
    uid: input.uid,
    createdAt: serverTimestamp(),
  });
  batch.update(userRef, {
    username: nextUsername,
    displayName,
    bio,
    photoURL,
    isPrivate: input.isPrivate,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${input.uid}`);
  }
  await syncPostsAuthorMetadata(input.uid, nextUsername, photoURL, input.isPrivate);
}

export async function uploadProfilePhoto(
  uid: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG, PNG, or WebP).');
  }
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('Profile photo must be smaller than 5 MB.');
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
  const storageRef = ref(storage, `avatars/${uid}/${Date.now()}_${safeName}`);

  return await new Promise<string>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0 && onProgress) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (error) => {
        if (error.code === 'storage/unauthorized') {
          reject(
            new Error(
              'Storage upload was denied. Make sure Firebase Storage is enabled and your storage rules allow avatar uploads.'
            )
          );
          return;
        }
        reject(new Error(error.message || 'Failed to upload profile photo.'));
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Could not retrieve uploaded photo URL.'));
        }
      }
    );
  });
}
