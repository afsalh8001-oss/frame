# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Identity Binding**: Users can only create posts, likes, comments, saves, recent searches, and outgoing follow requests as themselves (`request.auth.uid`).
2. **Private Account Isolation**: Posts authored by private accounts (`authorIsPrivate == true`) cannot be listed by other users and can only be read individually via `get` if the requester is the author or an accepted follower (`exists(users/{authorId}/followers/{uid})`).
3. **Atomic Counter Integrity**: `followersCount`, `followingCount`, `postsCount`, `likesCount`, and `commentsCount` can only increment/decrement in lockstep with corresponding atomic edge/subcollection writes.
4. **Comment Moderation**: Users can delete their own comments, and post owners can delete any comment on their posts.
5. **Bounded Payloads**: `imageURLs` (`1..10`), `hashtags` (`0..30`), `caption` (`0..2200`), `location` (`0..100`), `comment.text` (`1..1000`), strict `keys().hasOnly(...)` / `affectedKeys().hasOnly(...)` gates.

## 2. Dirty Dozen Adversarial Payloads

1. Unauthenticated user attempting to read or write `/posts/{postId}` -> `PERMISSION_DENIED`.
2. Creating a post with `authorId` set to another user's UID -> `PERMISSION_DENIED`.
3. Creating a post with `imageURLs` empty (`[]`) or > 10 images -> `PERMISSION_DENIED`.
4. Creating a post with `caption` > 2200 characters or shadow field `isSponsored: true` -> `PERMISSION_DENIED`.
5. Non-owner attempting to delete or edit another user's post caption -> `PERMISSION_DENIED`.
6. Non-follower listing private account's posts -> `PERMISSION_DENIED`.
7. Creating a like at `posts/{postId}/likes/{otherUid}` -> `PERMISSION_DENIED`.
8. Arbitrarily setting `likesCount: 99999` on `/posts/{postId}` without a matching like write -> `PERMISSION_DENIED`.
9. Deleting another user's comment on someone else's post -> `PERMISSION_DENIED`.
10. Reading or writing another user's `users/{otherUid}/saved` or `users/{otherUid}/recentSearches` -> `PERMISSION_DENIED`.
11. Directly creating `users/{privateUid}/followers/{myUid}` on a private account without an accepted follow request -> `PERMISSION_DENIED`.
12. Inflating `followersCount` without a corresponding atomic follower document creation -> `PERMISSION_DENIED`.
