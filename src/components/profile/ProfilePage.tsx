import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Grid3X3,
  Heart,
  Layers,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  UserPlus,
} from 'lucide-react';
import { FollowStatus, getFollowStatus, listFollowRequests } from '../../lib/followService';
import { listSavedPosts, listUserPosts } from '../../lib/postService';
import { AppView, Post, UserProfile } from '../../types/user';
import { Avatar } from '../Avatar';
import { FullPostModal } from '../post/FullPostModal';
import { FollowButton } from './FollowButton';
import { FollowersModal } from './FollowersModal';

interface ProfilePageProps {
  profile: UserProfile;
  currentUser: UserProfile;
  isOwnProfile: boolean;
  onNavigate: (view: AppView) => void;
}

export function ProfilePage({
  profile: initialProfile,
  currentUser,
  isOwnProfile,
  onNavigate,
}: ProfilePageProps) {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [followModalMode, setFollowModalMode] = useState<'followers' | 'following' | null>(null);

  useEffect(() => {
    setProfile(initialProfile);
    setActiveTab('posts');
  }, [initialProfile]);

  useEffect(() => {
    let active = true;
    setLoadingPosts(true);

    (async () => {
      try {
        let status: FollowStatus = 'none';
        if (!isOwnProfile) {
          status = await getFollowStatus(currentUser.uid, initialProfile.uid);
          if (active) setFollowStatus(status);
        } else if (initialProfile.isPrivate) {
          const reqs = await listFollowRequests(currentUser.uid);
          if (active) setPendingRequestsCount(reqs.length);
        }

        const userPosts = await listUserPosts({
          targetUid: initialProfile.uid,
          viewerUid: currentUser.uid,
          isPrivateAccount: initialProfile.isPrivate,
          isFollowing: status === 'following',
        });
        if (active) setPosts(userPosts);
      } finally {
        if (active) setLoadingPosts(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [initialProfile.uid, initialProfile.isPrivate, currentUser.uid, isOwnProfile]);

  useEffect(() => {
    if (!isOwnProfile || activeTab !== 'saved') return;
    let active = true;
    setLoadingSaved(true);
    (async () => {
      try {
        const list = await listSavedPosts(currentUser.uid);
        if (active) setSavedPosts(list);
      } finally {
        if (active) setLoadingSaved(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isOwnProfile, activeTab, currentUser.uid]);

  const canViewContent =
    isOwnProfile || !profile.isPrivate || followStatus === 'following';

  const displayedGrid = activeTab === 'posts' ? posts : savedPosts;
  const isGridLoading = activeTab === 'posts' ? loadingPosts : loadingSaved;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {!isOwnProfile && (
        <button
          type="button"
          onClick={() => onNavigate({ name: 'explore' })}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Explore
        </button>
      )}

      {/* Profile Header */}
      <section className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-10 pb-10 border-b border-zinc-200">
        <Avatar src={profile.photoURL} name={profile.displayName} size="xl" />

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 truncate">
                  {profile.displayName}
                </h1>
                {profile.isPrivate && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
                    <Lock className="w-3.5 h-3.5" />
                    Private
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm font-mono text-zinc-500">@{profile.username}</p>
            </div>

            {isOwnProfile ? (
              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                {(profile.isPrivate || pendingRequestsCount > 0) && (
                  <button
                    type="button"
                    onClick={() => onNavigate({ name: 'follow-requests' })}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Requests</span>
                    {pendingRequestsCount > 0 && (
                      <span className="font-mono text-xs tabular-nums text-blue-600">
                        {pendingRequestsCount}
                      </span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onNavigate({ name: 'edit-profile' })}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit profile
                </button>
              </div>
            ) : (
              <FollowButton
                currentUser={currentUser}
                targetUid={profile.uid}
                targetUser={profile}
                onStatusChange={(nextStatus, delta) => {
                  setFollowStatus(nextStatus);
                  setProfile((prev) => ({
                    ...prev,
                    followersCount: Math.max(0, prev.followersCount + delta),
                  }));
                }}
              />
            )}
          </div>

          {/* Counts */}
          <dl className="mt-6 flex items-center gap-8">
            <div className="flex items-baseline gap-1.5">
              <dt className="font-display text-base font-semibold tabular-nums text-zinc-900">
                {profile.postsCount}
              </dt>
              <dd className="text-sm text-zinc-500">
                {profile.postsCount === 1 ? 'post' : 'posts'}
              </dd>
            </div>

            <button
              type="button"
              disabled={!canViewContent}
              onClick={() => setFollowModalMode('followers')}
              className="flex items-baseline gap-1.5 hover:underline cursor-pointer disabled:cursor-default disabled:no-underline"
            >
              <span className="font-display text-base font-semibold tabular-nums text-zinc-900">
                {profile.followersCount}
              </span>
              <span className="text-sm text-zinc-500">
                {profile.followersCount === 1 ? 'follower' : 'followers'}
              </span>
            </button>

            <button
              type="button"
              disabled={!canViewContent}
              onClick={() => setFollowModalMode('following')}
              className="flex items-baseline gap-1.5 hover:underline cursor-pointer disabled:cursor-default disabled:no-underline"
            >
              <span className="font-display text-base font-semibold tabular-nums text-zinc-900">
                {profile.followingCount}
              </span>
              <span className="text-sm text-zinc-500">following</span>
            </button>
          </dl>

          {/* Bio */}
          <div className="mt-5 max-w-xl">
            {profile.bio ? (
              <p className="text-sm sm:text-[15px] text-zinc-700 leading-relaxed whitespace-pre-line">
                {profile.bio}
              </p>
            ) : isOwnProfile ? (
              <p className="text-sm text-zinc-400">
                No bio yet.{' '}
                <button
                  type="button"
                  onClick={() => onNavigate({ name: 'edit-profile' })}
                  className="text-zinc-600 hover:text-zinc-900 underline underline-offset-4 cursor-pointer"
                >
                  Add a short bio
                </button>
              </p>
            ) : (
              <p className="text-sm text-zinc-400">No bio provided.</p>
            )}
          </div>
        </div>
      </section>

      {/* Tabs & Grid Section */}
      <section className="pt-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('posts')}
              className={`inline-flex items-center gap-2 py-1.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'posts'
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              <span>Posts</span>
            </button>

            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setActiveTab('saved')}
                className={`inline-flex items-center gap-2 py-1.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'saved'
                    ? 'border-zinc-900 text-zinc-900'
                    : 'border-transparent text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <Bookmark className="w-4 h-4" />
                <span>Saved</span>
              </button>
            )}
          </div>

          {canViewContent && (
            <span className="text-xs font-mono tabular-nums text-zinc-400">
              {displayedGrid.length} {displayedGrid.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {!canViewContent ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center">
            <div className="w-11 h-11 rounded-xl bg-zinc-100 text-zinc-600 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="font-display text-base font-semibold text-zinc-900">
              This account is private
            </h2>
            <p className="mt-1 text-sm text-zinc-500 max-w-sm mx-auto">
              Follow @{profile.username} to see their photos and posts once approved.
            </p>
          </div>
        ) : isGridLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
          </div>
        ) : displayedGrid.length === 0 ? (
          <div className="relative">
            <div
              aria-hidden="true"
              className="grid grid-cols-3 gap-2 sm:gap-4 opacity-50 pointer-events-none"
            >
              {[0, 1, 2, 3, 4, 5].map((slot) => (
                <div
                  key={slot}
                  className="aspect-square rounded-xl border border-dashed border-zinc-200 bg-zinc-100/60"
                />
              ))}
            </div>

            <div className="mt-8 text-center py-4">
              <h2 className="font-display text-base font-semibold text-zinc-900">
                {activeTab === 'saved' ? 'No saved posts' : 'No posts yet'}
              </h2>
              <p className="mt-1 text-sm text-zinc-500 max-w-sm mx-auto">
                {activeTab === 'saved'
                  ? 'Posts you bookmark will appear here privately.'
                  : isOwnProfile
                  ? 'Share your first photo using the Create button in the navigation bar.'
                  : `@${profile.username} hasn't shared any posts yet.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {displayedGrid.map((post) => (
              <button
                key={post.postId}
                type="button"
                onClick={() => setSelectedPost(post)}
                className="group relative aspect-square rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 cursor-pointer"
              >
                <img
                  src={post.imageURLs[0]}
                  alt={post.caption || `Post by @${post.authorUsername}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                {post.imageURLs.length > 1 && (
                  <span className="absolute top-2.5 right-2.5 p-1 rounded-md bg-black/60 text-white">
                    <Layers className="w-3.5 h-3.5" />
                  </span>
                )}
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white text-sm font-medium tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <Heart className="w-4 h-4 fill-white" />
                    {post.likesCount}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 fill-white" />
                    {post.commentsCount}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedPost && (
        <FullPostModal
          post={selectedPost}
          currentUser={currentUser}
          onClose={() => setSelectedPost(null)}
          onNavigate={onNavigate}
          onDeleted={(deletedId) => {
            setPosts((prev) => prev.filter((p) => p.postId !== deletedId));
            setSavedPosts((prev) => prev.filter((p) => p.postId !== deletedId));
          }}
        />
      )}

      {followModalMode && (
        <FollowersModal
          targetUid={profile.uid}
          mode={followModalMode}
          currentUser={currentUser}
          onClose={() => setFollowModalMode(null)}
          onNavigate={onNavigate}
        />
      )}
    </main>
  );
}
