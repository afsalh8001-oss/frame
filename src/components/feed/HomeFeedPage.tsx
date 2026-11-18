import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Compass, Plus, RefreshCw } from 'lucide-react';
import { getFollowingIds } from '../../lib/followService';
import {
  createInitialFeedState,
  FeedCursorState,
  fetchHomeFeedPage,
} from '../../lib/postService';
import { AppView, Post, UserProfile } from '../../types/user';
import { PostCard } from '../post/PostCard';

interface HomeFeedPageProps {
  currentUser: UserProfile;
  onNavigate: (view: AppView) => void;
}

export function HomeFeedPage({ currentUser, onNavigate }: HomeFeedPageProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [feedState, setFeedState] = useState<FeedCursorState>(() => createInitialFeedState());
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Pull-to-refresh touch state
  const touchStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadInitialFeed = useCallback(async () => {
    setRefreshing(true);
    try {
      const ids = await getFollowingIds(currentUser.uid);
      setFollowedIds(ids);
      const freshState = createInitialFeedState();
      const result = await fetchHomeFeedPage({
        currentUser,
        followedIds: ids,
        state: freshState,
        pageSize: 10,
      });
      setPosts(result.posts);
      setFeedState(result.nextState);
      setHasMore(result.hasMore);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadInitialFeed();
  }, [loadInitialFeed]);

  const loadNextPage = useCallback(async () => {
    if (loadingMore || !hasMore || initialLoading) return;
    setLoadingMore(true);
    try {
      const result = await fetchHomeFeedPage({
        currentUser,
        followedIds,
        state: feedState,
        pageSize: 10,
      });
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.postId));
        const additions = result.posts.filter((p) => !seen.has(p.postId));
        return [...prev, ...additions];
      });
      setFeedState(result.nextState);
      setHasMore(result.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, initialLoading, currentUser, followedIds, feedState]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadNextPage();
        }
      },
      { rootMargin: '250px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadNextPage]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(80, delta * 0.5));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance >= 55) {
      void loadInitialFeed();
    }
    touchStartY.current = null;
    setPullDistance(0);
  };

  return (
    <main
      className="max-w-xl mx-auto px-4 sm:px-6 py-8"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {pullDistance > 12 && (
        <div
          className="flex items-center justify-center text-xs text-zinc-500 pb-4 transition-all"
          style={{ height: `${pullDistance}px` }}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${pullDistance >= 55 ? 'animate-spin' : ''}`} />
          <span>{pullDistance >= 55 ? 'Release to refresh' : 'Pull down to refresh'}</span>
        </div>
      )}

      {/* Feed Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">
            Home feed
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Recent posts from people you follow and your own updates.
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => void loadInitialFeed()}
          aria-label="Refresh feed"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Skeleton Loaders */}
      {initialLoading ? (
        <div className="space-y-6">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="bg-white border border-zinc-200 rounded-2xl overflow-hidden animate-pulse"
            >
              <div className="px-4 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-zinc-200" />
                <div className="h-3.5 w-28 bg-zinc-200 rounded" />
              </div>
              <div className="aspect-square bg-zinc-100" />
              <div className="p-4 space-y-2.5">
                <div className="h-3.5 w-20 bg-zinc-200 rounded" />
                <div className="h-3.5 w-3/4 bg-zinc-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center">
          <h2 className="font-display text-lg font-semibold text-zinc-900">
            Your feed is quiet
          </h2>
          <p className="mt-2 text-sm text-zinc-500 max-w-sm mx-auto">
            Follow people in Explore or publish your first photo to see posts here.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate({ name: 'create-post' })}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create post
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'explore' })}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              Explore profiles
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <PostCard
              key={post.postId}
              post={post}
              currentUser={currentUser}
              onNavigate={onNavigate}
              onDeleted={(deletedId) =>
                setPosts((prev) => prev.filter((p) => p.postId !== deletedId))
              }
            />
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="py-4 text-center">
            {loadingMore && (
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden animate-pulse">
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-200" />
                  <div className="h-3.5 w-28 bg-zinc-200 rounded" />
                </div>
                <div className="aspect-square bg-zinc-100" />
              </div>
            )}
            {!hasMore && posts.length > 0 && (
              <p className="text-xs text-zinc-400">You&apos;re all caught up.</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
