import {
  collection,
  deleteDoc,
  doc,
  DocumentSnapshot,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  QueryConstraint,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from './firebase';
import {
  BLUEPRINT_LIMITS,
  CommentItem,
  Post,
  PostLike,
  RecentSearchItem,
  UserProfile,
} from '../types/user';

export function parseHashtags(caption: string): string[] {
  const matches = caption.match(/#([a-zA-Z0-9_]{1,60})/g) ?? [];
  const unique = new Set<string>();
  for (const raw of matches) {
    const tag = raw.slice(1).toLowerCase();
    if (tag) unique.add(tag);
    if (unique.size >= 30) break;
  }
  return Array.from(unique);
}

export function formatRelativeTime(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return 'just now';
  const seconds = Math.floor((Date.now() - timestamp.toMillis()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return timestamp.toDate().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function generateId(): string {
  return doc(collection(db, 'posts')).id;
}

export async function uploadPostImages(
  uid: string,
  postId: string,
  files: File[],
  onProgress?: (percent: number) => void
): Promise<string[]> {
  if (files.length === 0 || files.length > BLUEPRINT_LIMITS.POST_MAX_IMAGES) {
    throw new Error(`Select between 1 and ${BLUEPRINT_LIMITS.POST_MAX_IMAGES} images.`);
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0) || 1;
  const uploadedBytes = new Array<number>(files.length).fill(0);

  const uploadSingle = (file: File, index: number): Promise<string> => {
    if (!file.type.startsWith('image/')) {
      return Promise.reject(new Error(`"${file.name}" is not a valid image file.`));
    }
    if (file.size > 10 * 1024 * 1024) {
      return Promise.reject(new Error(`"${file.name}" exceeds the 10 MB file limit.`));
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
    const storageRef = ref(storage, `posts/${uid}/${postId}/${index}_${safeName}`);

    return new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
      });

      task.on(
        'state_changed',
        (snapshot) => {
          uploadedBytes[index] = snapshot.bytesTransferred;
          if (onProgress) {
            const transferred = uploadedBytes.reduce((a, b) => a + b, 0);
            onProgress(Math.min(100, Math.round((transferred / totalBytes) * 100)));
          }
        },
        (err) => {
          if (err.code === 'storage/unauthorized') {
            reject(
              new Error(
                'Storage upload was denied. Make sure Firebase Storage is enabled and storage rules allow uploads to posts/{uid}/.'
              )
            );
            return;
          }
          reject(new Error(err.message || 'Failed to upload image.'));
        },
        async () => {
          try {
            const url = await getDownloadURL(task.snapshot.ref);
            resolve(url);
          } catch (err) {
            reject(err instanceof Error ? err : new Error('Could not retrieve image URL.'));
          }
        }
      );
    });
  };

  return await Promise.all(files.map((file, idx) => uploadSingle(file, idx)));
}

export async function createPostAtomic(params: {
  postId: string;
  author: UserProfile;
  imageURLs: string[];
  caption: string;
  location: string;
}): Promise<void> {
  const caption = params.caption.trim().slice(0, BLUEPRINT_LIMITS.CAPTION_MAX);
  const location = params.location.trim().slice(0, BLUEPRINT_LIMITS.LOCATION_MAX);
  const hashtags = parseHashtags(caption);

  const batch = writeBatch(db);
  const postRef = doc(db, 'posts', params.postId);

  batch.set(postRef, {
    postId: params.postId,
    authorId: params.author.uid,
    authorUsername: params.author.username,
    authorPhotoURL: params.author.photoURL,
    authorIsPrivate: params.author.isPrivate,
    imageURLs: params.imageURLs.slice(0, BLUEPRINT_LIMITS.POST_MAX_IMAGES),
    caption,
    hashtags,
    location,
    likesCount: 0,
    commentsCount: 0,
    createdAt: serverTimestamp(),
  });

  batch.update(doc(db, 'users', params.author.uid), {
    postsCount: increment(1),
  });

  // If author is private, fan out post pointer to accepted followers' privateFeed
  if (params.author.isPrivate) {
    try {
      const followersSnap = await getDocs(
        query(collection(db, 'users', params.author.uid, 'followers'), limit(150))
      );
      followersSnap.docs.forEach((fDoc) => {
        batch.set(doc(db, 'users', fDoc.id, 'privateFeed', params.postId), {
          postId: params.postId,
          authorId: params.author.uid,
          createdAt: serverTimestamp(),
        });
      });
    } catch {
      // Non-fatal
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `posts/${params.postId}`);
  }
}

export async function deletePostAtomic(post: Post): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'posts', post.postId));
  batch.update(doc(db, 'users', post.authorId), {
    postsCount: increment(-1),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `posts/${post.postId}`);
  }
}

export async function getPostById(postId: string): Promise<Post | null> {
  const path = `posts/${postId}`;
  try {
    const snap = await getDoc(doc(db, 'posts', postId));
    if (!snap.exists()) return null;
    return snap.data() as Post;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function listUserPosts(params: {
  targetUid: string;
  viewerUid: string;
  isPrivateAccount: boolean;
  isFollowing: boolean;
}): Promise<Post[]> {
  const { targetUid, viewerUid, isPrivateAccount, isFollowing } = params;

  if (targetUid === viewerUid) {
    const path = 'posts';
    try {
      const snap = await getDocs(
        query(
          collection(db, 'posts'),
          where('authorId', '==', targetUid),
          orderBy('createdAt', 'desc'),
          limit(60)
        )
      );
      return snap.docs.map((d) => d.data() as Post);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  if (!isPrivateAccount) {
    const path = 'posts';
    try {
      const snap = await getDocs(
        query(
          collection(db, 'posts'),
          where('authorId', '==', targetUid),
          where('authorIsPrivate', '==', false),
          orderBy('createdAt', 'desc'),
          limit(60)
        )
      );
      return snap.docs.map((d) => d.data() as Post);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  if (!isFollowing) {
    return [];
  }

  // Accepted follower of private account: load pointers from viewer's privateFeed
  try {
    const feedSnap = await getDocs(
      query(
        collection(db, 'users', viewerUid, 'privateFeed'),
        where('authorId', '==', targetUid),
        orderBy('createdAt', 'desc'),
        limit(60)
      )
    );
    const posts = await Promise.all(
      feedSnap.docs.map((d) => getPostById((d.data() as { postId: string }).postId).catch(() => null))
    );
    return posts.filter((p): p is Post => Boolean(p));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${viewerUid}/privateFeed`);
  }
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export interface FeedCursorState {
  publicChunkCursors: Record<number, DocumentSnapshot | null>;
  ownPrivateCursor: DocumentSnapshot | null;
  privateFeedCursor: DocumentSnapshot | null;
  exhaustedChunks: Record<number, boolean>;
  ownPrivateExhausted: boolean;
  privateFeedExhausted: boolean;
  bufferedPosts: Post[];
}

export function createInitialFeedState(): FeedCursorState {
  return {
    publicChunkCursors: {},
    ownPrivateCursor: null,
    privateFeedCursor: null,
    exhaustedChunks: {},
    ownPrivateExhausted: false,
    privateFeedExhausted: false,
    bufferedPosts: [],
  };
}

export async function fetchHomeFeedPage(params: {
  currentUser: UserProfile;
  followedIds: string[];
  state: FeedCursorState;
  pageSize?: number;
}): Promise<{ posts: Post[]; nextState: FeedCursorState; hasMore: boolean }> {
  const pageSize = params.pageSize ?? 10;
  const { currentUser, followedIds, state } = params;

  const allAuthorIds = Array.from(new Set([currentUser.uid, ...followedIds]));
  const chunks = chunkArray(allAuthorIds, 30);

  const nextState: FeedCursorState = {
    publicChunkCursors: { ...state.publicChunkCursors },
    ownPrivateCursor: state.ownPrivateCursor,
    privateFeedCursor: state.privateFeedCursor,
    exhaustedChunks: { ...state.exhaustedChunks },
    ownPrivateExhausted: state.ownPrivateExhausted,
    privateFeedExhausted: state.privateFeedExhausted,
    bufferedPosts: [...state.bufferedPosts],
  };

  const fetched: Post[] = [];

  // 1. Fetch public posts across 30-author chunks
  await Promise.all(
    chunks.map(async (chunk, idx) => {
      if (nextState.exhaustedChunks[idx]) return;
      const constraints: QueryConstraint[] = [
        where('authorId', 'in', chunk),
        where('authorIsPrivate', '==', false),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
      ];
      const cursor = nextState.publicChunkCursors[idx];
      if (cursor) {
        constraints.push(startAfter(cursor));
      }

      try {
        const snap = await getDocs(query(collection(db, 'posts'), ...constraints));
        snap.docs.forEach((d) => fetched.push(d.data() as Post));
        if (snap.docs.length < pageSize) {
          nextState.exhaustedChunks[idx] = true;
        } else {
          nextState.publicChunkCursors[idx] = snap.docs[snap.docs.length - 1];
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'posts');
      }
    })
  );

  // 2. If current user is private, also include their own posts
  if (currentUser.isPrivate && !nextState.ownPrivateExhausted) {
    const ownConstraints: QueryConstraint[] = [
      where('authorId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    ];
    if (nextState.ownPrivateCursor) {
      ownConstraints.push(startAfter(nextState.ownPrivateCursor));
    }
    try {
      const ownSnap = await getDocs(query(collection(db, 'posts'), ...ownConstraints));
      ownSnap.docs.forEach((d) => fetched.push(d.data() as Post));
      if (ownSnap.docs.length < pageSize) {
        nextState.ownPrivateExhausted = true;
      } else {
        nextState.ownPrivateCursor = ownSnap.docs[ownSnap.docs.length - 1];
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    }
  } else {
    nextState.ownPrivateExhausted = true;
  }

  // 3. Include accepted private followed posts from privateFeed
  if (followedIds.length > 0 && !nextState.privateFeedExhausted) {
    const pfConstraints: QueryConstraint[] = [
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    ];
    if (nextState.privateFeedCursor) {
      pfConstraints.push(startAfter(nextState.privateFeedCursor));
    }
    try {
      const pfSnap = await getDocs(
        query(collection(db, 'users', currentUser.uid, 'privateFeed'), ...pfConstraints)
      );
      const pfPosts = await Promise.all(
        pfSnap.docs.map((d) =>
          getPostById((d.data() as { postId: string }).postId).catch(() => null)
        )
      );
      pfPosts.forEach((p) => {
        if (p) fetched.push(p);
      });
      if (pfSnap.docs.length < pageSize) {
        nextState.privateFeedExhausted = true;
      } else {
        nextState.privateFeedCursor = pfSnap.docs[pfSnap.docs.length - 1];
      }
    } catch {
      nextState.privateFeedExhausted = true;
    }
  } else {
    nextState.privateFeedExhausted = true;
  }

  // Merge, deduplicate, and sort newest first
  const mergedMap = new Map<string, Post>();
  [...nextState.bufferedPosts, ...fetched].forEach((post) => {
    mergedMap.set(post.postId, post);
  });

  const sorted = Array.from(mergedMap.values()).sort((a, b) => {
    const aMs = a.createdAt ? a.createdAt.toMillis() : Date.now();
    const bMs = b.createdAt ? b.createdAt.toMillis() : Date.now();
    return bMs - aMs;
  });

  const pagePosts = sorted.slice(0, pageSize);
  nextState.bufferedPosts = sorted.slice(pageSize);

  const allChunksExhausted = chunks.every((_, idx) => nextState.exhaustedChunks[idx]);
  const hasMore =
    nextState.bufferedPosts.length > 0 ||
    !allChunksExhausted ||
    !nextState.ownPrivateExhausted ||
    !nextState.privateFeedExhausted;

  return { posts: pagePosts, nextState, hasMore };
}

export async function checkPostLiked(postId: string, uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'posts', postId, 'likes', uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `posts/${postId}/likes/${uid}`);
  }
}

export async function togglePostLike(
  postId: string,
  currentUser: UserProfile,
  shouldLike: boolean
): Promise<void> {
  const batch = writeBatch(db);
  const likeRef = doc(db, 'posts', postId, 'likes', currentUser.uid);
  const postRef = doc(db, 'posts', postId);

  if (shouldLike) {
    batch.set(likeRef, {
      uid: currentUser.uid,
      username: currentUser.username,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL,
      createdAt: serverTimestamp(),
    });
    batch.update(postRef, { likesCount: increment(1) });
  } else {
    batch.delete(likeRef);
    batch.update(postRef, { likesCount: increment(-1) });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `posts/${postId}/likes/${currentUser.uid}`);
  }
}

export async function listPostLikes(postId: string): Promise<PostLike[]> {
  const path = `posts/${postId}/likes`;
  try {
    const snap = await getDocs(
      query(collection(db, 'posts', postId, 'likes'), orderBy('createdAt', 'desc'), limit(100))
    );
    return snap.docs.map((d) => d.data() as PostLike);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listPostComments(postId: string): Promise<CommentItem[]> {
  const path = `posts/${postId}/comments`;
  try {
    const snap = await getDocs(
      query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'), limit(200))
    );
    return snap.docs.map((d) => d.data() as CommentItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addPostComment(params: {
  postId: string;
  currentUser: UserProfile;
  text: string;
  parentId?: string;
}): Promise<CommentItem> {
  const trimmed = params.text.trim().slice(0, BLUEPRINT_LIMITS.COMMENT_MAX);
  if (!trimmed) throw new Error('Comment cannot be empty.');

  const commentId = doc(collection(db, 'posts', params.postId, 'comments')).id;
  const parentId = params.parentId ?? '';

  const batch = writeBatch(db);
  batch.set(doc(db, 'posts', params.postId, 'comments', commentId), {
    commentId,
    authorId: params.currentUser.uid,
    username: params.currentUser.username,
    photoURL: params.currentUser.photoURL,
    text: trimmed,
    likesCount: 0,
    parentId,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, 'posts', params.postId), {
    commentsCount: increment(1),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `posts/${params.postId}/comments/${commentId}`);
  }

  return {
    commentId,
    authorId: params.currentUser.uid,
    username: params.currentUser.username,
    photoURL: params.currentUser.photoURL,
    text: trimmed,
    likesCount: 0,
    parentId,
    createdAt: Timestamp.now(),
  };
}

export async function deletePostComment(params: {
  postId: string;
  commentId: string;
  replyIds?: string[];
}): Promise<void> {
  const replyIds = params.replyIds ?? [];
  const batch = writeBatch(db);

  batch.delete(doc(db, 'posts', params.postId, 'comments', params.commentId));
  replyIds.forEach((rid) => {
    batch.delete(doc(db, 'posts', params.postId, 'comments', rid));
  });
  batch.update(doc(db, 'posts', params.postId), {
    commentsCount: increment(-(1 + replyIds.length)),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `posts/${params.postId}/comments/${params.commentId}`
    );
  }
}

export async function toggleCommentLike(
  postId: string,
  commentId: string,
  uid: string,
  shouldLike: boolean
): Promise<void> {
  const batch = writeBatch(db);
  const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'likes', uid);
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);

  if (shouldLike) {
    batch.set(likeRef, { uid, createdAt: serverTimestamp() });
    batch.update(commentRef, { likesCount: increment(1) });
  } else {
    batch.delete(likeRef);
    batch.update(commentRef, { likesCount: increment(-1) });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `posts/${postId}/comments/${commentId}/likes/${uid}`
    );
  }
}

export async function checkCommentLikes(
  postId: string,
  commentIds: string[],
  uid: string
): Promise<Record<string, boolean>> {
  const results = await Promise.all(
    commentIds.map(async (cid) => {
      try {
        const snap = await getDoc(doc(db, 'posts', postId, 'comments', cid, 'likes', uid));
        return [cid, snap.exists()] as const;
      } catch {
        return [cid, false] as const;
      }
    })
  );
  return Object.fromEntries(results);
}

export async function checkPostSaved(uid: string, postId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'saved', postId));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}/saved/${postId}`);
  }
}

export async function toggleSavePost(
  uid: string,
  post: Post,
  shouldSave: boolean
): Promise<void> {
  const path = `users/${uid}/saved/${post.postId}`;
  try {
    if (shouldSave) {
      await setDoc(doc(db, 'users', uid, 'saved', post.postId), {
        postId: post.postId,
        authorId: post.authorId,
        createdAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(doc(db, 'users', uid, 'saved', post.postId));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function listSavedPosts(uid: string): Promise<Post[]> {
  const path = `users/${uid}/saved`;
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'saved'), orderBy('createdAt', 'desc'), limit(60))
    );
    const posts = await Promise.all(
      snap.docs.map((d) =>
        getPostById((d.data() as { postId: string }).postId).catch(() => null)
      )
    );
    return posts.filter((p): p is Post => Boolean(p));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listExplorePopularPosts(): Promise<Post[]> {
  const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const path = 'posts';

  try {
    const snap = await getDocs(
      query(
        collection(db, 'posts'),
        where('authorIsPrivate', '==', false),
        where('createdAt', '>=', sevenDaysAgo),
        orderBy('likesCount', 'desc'),
        limit(30)
      )
    );
    return snap.docs.map((d) => d.data() as Post);
  } catch (error) {
    // Graceful fallback if composite index hasn't been created yet in Firebase Console
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('index') || msg.includes('failed-precondition')) {
      try {
        const fallbackSnap = await getDocs(
          query(
            collection(db, 'posts'),
            where('authorIsPrivate', '==', false),
            where('createdAt', '>=', sevenDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(60)
          )
        );
        return fallbackSnap.docs
          .map((d) => d.data() as Post)
          .sort((a, b) => b.likesCount - a.likesCount)
          .slice(0, 30);
      } catch (innerErr) {
        handleFirestoreError(innerErr, OperationType.LIST, path);
      }
    }
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listPostsByHashtag(rawTag: string): Promise<Post[]> {
  const tag = rawTag.trim().toLowerCase().replace(/^#+/, '');
  if (!tag) return [];

  const path = 'posts';
  try {
    const snap = await getDocs(
      query(
        collection(db, 'posts'),
        where('authorIsPrivate', '==', false),
        where('hashtags', 'array-contains', tag),
        orderBy('createdAt', 'desc'),
        limit(30)
      )
    );
    return snap.docs.map((d) => d.data() as Post);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('index') || msg.includes('failed-precondition')) {
      try {
        const fallbackSnap = await getDocs(
          query(
            collection(db, 'posts'),
            where('authorIsPrivate', '==', false),
            where('hashtags', 'array-contains', tag),
            limit(30)
          )
        );
        return fallbackSnap.docs
          .map((d) => d.data() as Post)
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      } catch (innerErr) {
        handleFirestoreError(innerErr, OperationType.LIST, path);
      }
    }
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listRecentSearches(uid: string): Promise<RecentSearchItem[]> {
  const path = `users/${uid}/recentSearches`;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'users', uid, 'recentSearches'),
        orderBy('createdAt', 'desc'),
        limit(12)
      )
    );
    return snap.docs.map((d) => d.data() as RecentSearchItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveRecentSearch(
  uid: string,
  item: Omit<RecentSearchItem, 'createdAt'>
): Promise<void> {
  const path = `users/${uid}/recentSearches/${item.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'recentSearches', item.id), {
      ...item,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteRecentSearch(uid: string, searchId: string): Promise<void> {
  const path = `users/${uid}/recentSearches/${searchId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'recentSearches', searchId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearRecentSearches(uid: string): Promise<void> {
  const path = `users/${uid}/recentSearches`;
  try {
    const snap = await getDocs(query(collection(db, 'users', uid, 'recentSearches'), limit(50)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
