import { useEffect, useState } from 'react';
import { ArrowLeft, Hash, Heart, Layers, Loader2, MessageCircle } from 'lucide-react';
import { listPostsByHashtag } from '../../lib/postService';
import { AppView, Post, UserProfile } from '../../types/user';
import { FullPostModal } from '../post/FullPostModal';

interface HashtagPageProps {
  tag: string;
  currentUser: UserProfile;
  onNavigate: (view: AppView) => void;
}

export function HashtagPage({ tag, currentUser, onNavigate }: HashtagPageProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const list = await listPostsByHashtag(tag);
        if (active) setPosts(list);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tag]);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <button
        type="button"
        onClick={() => onNavigate({ name: 'explore' })}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Explore
      </button>

      <div className="pb-6 border-b border-zinc-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700">
            <Hash className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">
              #{tag}
            </h1>
            <p className="text-sm text-zinc-500 tabular-nums">
              {loading ? 'Loading...' : `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="mt-10 bg-white border border-zinc-200 rounded-2xl p-10 text-center">
          <p className="font-display text-base font-semibold text-zinc-900">
            No public posts for #{tag}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Include #{tag} in a post caption to have it appear here.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-4">
          {posts.map((post) => (
            <button
              key={post.postId}
              type="button"
              onClick={() => setSelectedPost(post)}
              className="group relative aspect-square rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 cursor-pointer"
            >
              <img
                src={post.imageURLs[0]}
                alt={post.caption || `#${tag}`}
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

      {selectedPost && (
        <FullPostModal
          post={selectedPost}
          currentUser={currentUser}
          onClose={() => setSelectedPost(null)}
          onNavigate={onNavigate}
          onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.postId !== id))}
        />
      )}
    </main>
  );
}
