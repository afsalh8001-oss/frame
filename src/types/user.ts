import type { Timestamp } from 'firebase/firestore';

export const BLUEPRINT_LIMITS = {
  UID_MIN: 1,
  UID_MAX: 128,
  UID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  USERNAME_PATTERN: /^[a-z0-9_]+$/,
  DISPLAY_NAME_MIN: 1,
  DISPLAY_NAME_MAX: 60,
  BIO_MAX: 200,
  PHOTO_URL_MAX: 1000,
  CAPTION_MAX: 2200,
  LOCATION_MAX: 100,
  POST_MAX_IMAGES: 10,
  COMMENT_MAX: 1000,
} as const;

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  photoURL: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isPrivate: boolean;
  createdAt: Timestamp | null;
}

export interface FollowerEdge {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  createdAt: Timestamp | null;
}

export interface FollowRequest {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  createdAt: Timestamp | null;
}

export interface Post {
  postId: string;
  authorId: string;
  authorUsername: string;
  authorPhotoURL: string;
  authorIsPrivate: boolean;
  imageURLs: string[];
  caption: string;
  hashtags: string[];
  location: string;
  likesCount: number;
  commentsCount: number;
  createdAt: Timestamp | null;
}

export interface PostLike {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  createdAt: Timestamp | null;
}

export interface CommentItem {
  commentId: string;
  authorId: string;
  username: string;
  photoURL: string;
  text: string;
  likesCount: number;
  parentId: string;
  createdAt: Timestamp | null;
}

export interface RecentSearchItem {
  id: string;
  type: 'user' | 'hashtag';
  query: string;
  label: string;
  targetUid: string;
  photoURL: string;
  createdAt: Timestamp | null;
}

export interface PendingRegistration {
  username: string;
  displayName: string;
}

export type AuthScreen = 'login' | 'signup' | 'reset-password';

export type AppView =
  | { name: 'login' }
  | { name: 'signup' }
  | { name: 'reset-password' }
  | { name: 'verify-email' }
  | { name: 'onboarding' }
  | { name: 'feed' }
  | { name: 'create-post' }
  | { name: 'explore' }
  | { name: 'profile' }
  | { name: 'edit-profile' }
  | { name: 'follow-requests' }
  | { name: 'user-profile'; uid: string }
  | { name: 'hashtag'; tag: string }
  | { name: 'post'; postId: string };
