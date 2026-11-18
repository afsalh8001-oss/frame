/**
 * Security Rules Verification Spec for users, posts, follows, likes, comments, saves, and searches.
 */

export interface SecurityTestCase {
  name: string;
  actorUid: string | null;
  emailVerified: boolean;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'ALLOW' | 'PERMISSION_DENIED';
}

export const dirtyDozenCases: SecurityTestCase[] = [
  {
    name: '1. Unauthenticated post list',
    actorUid: null,
    emailVerified: false,
    operation: 'list',
    path: 'posts',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Post creation with spoofed authorId',
    actorUid: 'u1',
    emailVerified: true,
    operation: 'create',
    path: 'posts/p1',
    payload: { postId: 'p1', authorId: 'u2' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Post creation with 0 images',
    actorUid: 'u1',
    emailVerified: true,
    operation: 'create',
    path: 'posts/p1',
    payload: { postId: 'p1', authorId: 'u1', imageURLs: [] },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Post creation with shadow field or oversized caption',
    actorUid: 'u1',
    emailVerified: true,
    operation: 'create',
    path: 'posts/p1',
    payload: { postId: 'p1', authorId: 'u1', isFeatured: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Cross-user post edit',
    actorUid: 'u1',
    emailVerified: true,
    operation: 'update',
    path: 'posts/p_owned_by_u2',
    payload: { caption: 'hacked' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Non-follower listing private posts',
    actorUid: 'u1',
    emailVerified: true,
    operation: 'list',
    path: 'posts',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Spoofing like for another user',
    actorUid: 'u1',
    emailVerified: true,
    operation: 'create',
    path: 'posts/p1/likes/u2',
    payload: { uid: 'u2' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Arbitrarily inflating likesCount',
    actorUid: 'u1',
    emailVerified: true,
    operation: 'update',
    path: 'posts/p1',
    payload: { likesCount: 99999 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Deleting someone else comment on third-party post',
    actorUid: 'u1',
    emailVerified: true,
    operation: 'delete',
    path: 'posts/p_u2/comments/c_u3',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Reading another user saved posts',
    actorUid: 'u1',
    emailVerified: true,
    operation: 'list',
    path: 'users/u2/saved',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Bypassing follow request on private account',
    actorUid: 'u1',
    emailVerified: true,
    operation: 'create',
    path: 'users/private_u2/followers/u1',
    payload: { uid: 'u1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Inflating followersCount without follower edge',
    actorUid: 'u1',
    emailVerified: true,
    operation: 'update',
    path: 'users/u2',
    payload: { followersCount: 500 },
    expected: 'PERMISSION_DENIED',
  },
];
