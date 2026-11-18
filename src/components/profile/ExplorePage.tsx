import { useEffect, useState } from 'react';
import { Clock, Hash, Heart, Layers, Loader2, MessageCircle, Search, Users, X } from 'lucide-react';
import {
  clearRecentSearches,
  deleteRecentSearch,
  listExplorePopularPosts,
  listRecentSearches,
  saveRecentSearch,
} from '../../lib/postService';
import { listPublicProfiles, searchUsersByUsernamePrefix } from '../../lib/userService';
import { AppView, Post, RecentSearchItem, UserProfile } from '../../types/user';
import { Avatar } from '../Avatar';
import { FullPostModal } from '../post/FullPostModal';

interface ExplorePageProps {
  currentUser: UserProfile;
  onNavigate: (view: AppView) => void;
}

export function ExplorePage({ currentUser, onNavigate }: ExplorePageProps) {
  const [popularPosts, setPopularPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMatches, setUserMatches] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [posts, profiles, recents] = await Promise.all([
          listExplorePopularPosts(),
          listPublicProfiles(),
          listRecentSearches(currentUser.uid),
        ]);
        if (!active) return;
        setPopularPosts(posts);
        setSuggestedUsers(profiles.filter((u) => u.uid !== currentUser.uid).slice(0, 6));
        setRecentSearches(recents);
      } finally {
        if (active) setLoadingPosts(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentUser.uid]);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      setUserMatches([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchUsersByUsernamePrefix(trimmed);
        if (!cancelled) setUserMatches(results);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchTerm]);

  const cleanTagQuery = searchTerm.trim().replace(/^#+/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');

  const handleSelectUser = async (user: UserProfile) => {
    setSearchFocused(false);
    const searchItem = {
      id: `user_${user.uid}`,
      type: 'user' as const,
      query: user.username,
      label: user.displayName,
      targetUid: user.uid,
      photoURL: user.photoURL,
    };
    void saveRecentSearch(currentUser.uid, searchItem).then(() => {
      setRecentSearches((prev) => [
        { ...searchItem, createdAt: null },
        ...prev.filter((r) => r.id !== searchItem.id),
      ]);
    });
    if (user.uid === currentUser.uid) {
      onNavigate({ name: 'profile' });
    } else {
      onNavigate({ name: 'user-profile', uid: user.uid });
    }
  };

  const handleSelectHashtag = async (tag: string) => {
    if (!tag) return;
    setSearchFocused(false);
    const searchItem = {
      id: `tag_${tag}`,
      type: 'hashtag' as const,
      query: tag,
      label: `#${tag}`,
      targetUid: '',
      photoURL: '',
    };
    void saveRecentSearch(currentUser.uid, searchItem).then(() => {
      setRecentSearches((prev) => [
        { ...searchItem, createdAt: null },
        ...prev.filter((r) => r.id !== searchItem.id),
      ]);
    });
    onNavigate({ name: 'hashtag', tag });
  };

  const handleSelectRecent = (item: RecentSearchItem) => {
    setSearchFocused(false);
    if (item.type === 'hashtag') {
      onNavigate({ name: 'hashtag', tag: item.query });
    } else if (item.targetUid === currentUser.uid) {
      onNavigate({ name: 'profile' });
    } else if (item.targetUid) {
      onNavigate({ name: 'user-profile', uid: item.targetUid });
    }
  };

  const handleDeleteRecent = async (id: string) => {
    setRecentSearches((prev) => prev.filter((r) => r.id !== id));
    await deleteRecentSearch(currentUser.uid, id);
  };

  const handleClearRecents = async () => {
    setRecentSearches([]);
    await clearRecentSearches(currentUser.uid);
  };

  const showDropdown =
    searchFocused && (searchTerm.trim().length > 0 || recentSearches.length > 0);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">
          Explore
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Search users or #hashtags, and discover popular posts from the past 7 days.
        </p>
      </div>

      {/* Search Bar & Dropdown */}
      <div className="relative mb-10">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onFocus={() => setSearchFocused(true)}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSearchFocused(true);
            }}
            placeholder="Search username or #hashtag..."
            className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {showDropdown && (
          <div className="mt-2 bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
            {searchTerm.trim().length === 0 ? (
              <div className="p-3">
                <div className="px-2 py-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Recent searches
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleClearRecents()}
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-900 cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>
                <ul className="divide-y divide-zinc-100">
                  {recentSearches.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 px-2 py-2 hover:bg-zinc-50 rounded-xl"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectRecent(item)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        {item.type === 'hashtag' ? (
                          <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700 shrink-0">
                            <Hash className="w-4 h-4" />
                          </div>
                        ) : (
                          <Avatar src={item.photoURL} name={item.label} size="sm" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">
                            {item.label}
                          </p>
                          <p className="text-xs font-mono text-zinc-500 truncate">
                            {item.type === 'hashtag' ? 'Hashtag' : `@${item.query}`}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteRecent(item.id)}
                        aria-label="Remove recent search"
                        className="p-1.5 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {cleanTagQuery && (
                  <button
                    type="button"
                    onClick={() => void handleSelectHashtag(cleanTagQuery)}
                    className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-zinc-50 rounded-xl text-left cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700 shrink-0">
                      <Hash className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">#{cleanTagQuery}</p>
                      <p className="text-xs text-zinc-500">Explore posts tagged #{cleanTagQuery}</p>
                    </div>
                  </button>
                )}

                {!searchTerm.trim().startsWith('#') && (
                  <div>
                    {searching ? (
                      <div className="py-4 flex justify-center">
                        <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                      </div>
                    ) : userMatches.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-zinc-500">
                        No public users matching &ldquo;{searchTerm.trim()}&rdquo;.
                      </p>
                    ) : (
                      <ul className="divide-y divide-zinc-100">
                        {userMatches.map((user) => (
                          <li key={user.uid}>
                            <button
                              type="button"
                              onClick={() => void handleSelectUser(user)}
                              className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-zinc-50 rounded-xl text-left cursor-pointer"
                            >
                              <Avatar src={user.photoURL} name={user.displayName} size="sm" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-zinc-900 truncate">
                                  {user.displayName}
                                </p>
                                <p className="text-xs font-mono text-zinc-500 truncate">
                                  @{user.username}
                                </p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="pt-1 border-t border-zinc-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSearchFocused(false)}
                    className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-900 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Popular Posts Grid (Last 7 Days) */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-semibold text-zinc-900">
            Popular this week
          </h2>
          <span className="text-xs text-zinc-400">Sorted by likes</span>
        </div>

        {loadingPosts ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="aspect-square rounded-xl bg-zinc-200/70 animate-pulse"
              />
            ))}
          </div>
        ) : popularPosts.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-zinc-500">
              No public posts from the last 7 days yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {popularPosts.map((post) => (
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

      {/* Public Profiles Directory */}
      {suggestedUsers.length > 0 && (
        <section>
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 mb-4">
            <Users className="w-4 h-4 text-zinc-500" />
            <span>People on Frame</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestedUsers.map((member) => (
              <button
                key={member.uid}
                type="button"
                onClick={() => void handleSelectUser(member)}
                className="text-left bg-white border border-zinc-200 hover:border-zinc-300 rounded-2xl p-4 flex items-center gap-3.5 transition-colors cursor-pointer"
              >
                <Avatar src={member.photoURL} name={member.displayName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold text-zinc-900 truncate">
                    {member.displayName}
                  </p>
                  <p className="text-xs font-mono text-zinc-500 truncate">
                    @{member.username}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400 tabular-nums">
                    {member.followersCount} followers
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedPost && (
        <FullPostModal
          post={selectedPost}
          currentUser={currentUser}
          onClose={() => setSelectedPost(null)}
          onNavigate={onNavigate}
          onDeleted={(deletedId) =>
            setPopularPosts((prev) => prev.filter((p) => p.postId !== deletedId))
          }
        />
      )}
    </main>
  );
}
