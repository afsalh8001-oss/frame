import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { FollowerEdge, FollowRequest, Post, UserProfile } from '../types/user';

export type FollowStatus = 'following' | 'requested' | 'none';

export async function getFollowStatus(
  currentUid: string,
  targetUid: string
): Promise<FollowStatus> {
  if (currentUid === targetUid) return 'none';

  const followingPath = `users/${currentUid}/following/${targetUid}`;
  try {
    const followingSnap = await getDoc(doc(db, 'users', currentUid, 'following', targetUid));
    if (followingSnap.exists()) return 'following';

    const requestSnap = await getDoc(doc(db, 'users', targetUid, 'followRequests', currentUid));
    if (requestSnap.exists()) return 'requested';

    return 'none';
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, followingPath);
  }
}

export async function followPublicUser(
  currentUser: UserProfile,
  targetUser: UserProfile
): Promise<void> {
  if (currentUser.uid === targetUser.uid) return;
  const batch = writeBatch(db);

  const followerDocRef = doc(db, 'users', targetUser.uid, 'followers', currentUser.uid);
  const followingDocRef = doc(db, 'users', currentUser.uid, 'following', targetUser.uid);
  const targetUserRef = doc(db, 'users', targetUser.uid);
  const currentUserRef = doc(db, 'users', currentUser.uid);

  batch.set(followerDocRef, {
    uid: currentUser.uid,
    username: currentUser.username,
    displayName: currentUser.displayName,
    photoURL: currentUser.photoURL,
    createdAt: serverTimestamp(),
  });

  batch.set(followingDocRef, {
    uid: targetUser.uid,
    username: targetUser.username,
    displayName: targetUser.displayName,
    photoURL: targetUser.photoURL,
    createdAt: serverTimestamp(),
  });

  batch.update(targetUserRef, { followersCount: increment(1) });
  batch.update(currentUserRef, { followingCount: increment(1) });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${targetUser.uid}/followers/${currentUser.uid}`);
  }
}

export async function unfollowUser(currentUid: string, targetUid: string): Promise<void> {
  if (currentUid === targetUid) return;
  const batch = writeBatch(db);

  batch.delete(doc(db, 'users', targetUid, 'followers', currentUid));
  batch.delete(doc(db, 'users', currentUid, 'following', targetUid));
  batch.update(doc(db, 'users', targetUid), { followersCount: increment(-1) });
  batch.update(doc(db, 'users', currentUid), { followingCount: increment(-1) });

  // Clean up any privateFeed items cached from targetUid
  try {
    const privateFeedSnap = await getDocs(
      query(
        collection(db, 'users', currentUid, 'privateFeed'),
        where('authorId', '==', targetUid),
        limit(100)
      )
    );
    privateFeedSnap.docs.forEach((d) => batch.delete(d.ref));
  } catch {
    // Non-fatal if none exist
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${targetUid}/followers/${currentUid}`);
  }
}

export async function sendFollowRequest(
  currentUser: UserProfile,
  targetUid: string
): Promise<void> {
  const path = `users/${targetUid}/followRequests/${currentUser.uid}`;
  try {
    await setDoc(doc(db, 'users', targetUid, 'followRequests', currentUser.uid), {
      uid: currentUser.uid,
      username: currentUser.username,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function cancelFollowRequest(
  currentUid: string,
  targetUid: string
): Promise<void> {
  const path = `users/${targetUid}/followRequests/${currentUid}`;
  try {
    await deleteDoc(doc(db, 'users', targetUid, 'followRequests', currentUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function listFollowRequests(uid: string): Promise<FollowRequest[]> {
  const path = `users/${uid}/followRequests`;
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'followRequests'), orderBy('createdAt', 'desc'), limit(50))
    );
    return snap.docs.map((d) => d.data() as FollowRequest);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function acceptFollowRequest(
  currentUser: UserProfile,
  requester: FollowRequest
): Promise<void> {
  const batch = writeBatch(db);

  batch.delete(doc(db, 'users', currentUser.uid, 'followRequests', requester.uid));
  batch.set(doc(db, 'users', currentUser.uid, 'followers', requester.uid), {
    uid: requester.uid,
    username: requester.username,
    displayName: requester.displayName,
    photoURL: requester.photoURL,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'users', requester.uid, 'following', currentUser.uid), {
    uid: currentUser.uid,
    username: currentUser.username,
    displayName: currentUser.displayName,
    photoURL: currentUser.photoURL,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, 'users', currentUser.uid), { followersCount: increment(1) });
  batch.update(doc(db, 'users', requester.uid), { followingCount: increment(1) });

  // Share recent posts into requester's privateFeed if currentUser is private
  try {
    const recentPostsSnap = await getDocs(
      query(
        collection(db, 'posts'),
        where('authorId', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(40)
      )
    );
    recentPostsSnap.docs.forEach((postDoc) => {
      const postData = postDoc.data() as Post;
      batch.set(doc(db, 'users', requester.uid, 'privateFeed', postData.postId), {
        postId: postData.postId,
        authorId: currentUser.uid,
        createdAt: postData.createdAt ?? serverTimestamp(),
      });
    });
  } catch {
    // Non-fatal if user has no posts yet
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}/followRequests/${requester.uid}`);
  }
}

export async function declineFollowRequest(
  currentUid: string,
  requesterUid: string
): Promise<void> {
  const path = `users/${currentUid}/followRequests/${requesterUid}`;
  try {
    await deleteDoc(doc(db, 'users', currentUid, 'followRequests', requesterUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function listFollowers(uid: string): Promise<FollowerEdge[]> {
  const path = `users/${uid}/followers`;
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'followers'), orderBy('createdAt', 'desc'), limit(100))
    );
    return snap.docs.map((d) => d.data() as FollowerEdge);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listFollowing(uid: string): Promise<FollowerEdge[]> {
  const path = `users/${uid}/following`;
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'following'), orderBy('createdAt', 'desc'), limit(100))
    );
    return snap.docs.map((d) => d.data() as FollowerEdge);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getFollowingIds(uid: string): Promise<string[]> {
  const path = `users/${uid}/following`;
  try {
    const snap = await getDocs(query(collection(db, 'users', uid, 'following'), limit(500)));
    return snap.docs.map((d) => d.id);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
