import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getPostById } from '../../lib/postService';
import { AppView, Post, UserProfile } from '../../types/user';
import { PostCard } from './PostCard';

interface PostDetailPageProps {
  postId: string;
  currentUser: UserProfile;
  onNavigate: (view: AppView) => void;
}

export function PostDetailPage({ postId, currentUser, onNavigate }: PostDetailPageProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const fetched = await getPostById(postId);
        if (active) setPost(fetched);
      } catch {
        if (active) {
          setError('You do not have permission to view this post, or it no longer exists.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [postId]);

  return (
    <main className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <button
        type="button"
        onClick={() => onNavigate({ name: 'feed' })}
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Feed
      </button>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
        </div>
      ) : error || !post ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center">
          <h1 className="font-display text-lg font-semibold text-zinc-900">Post unavailable</h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            {error ?? 'This post may have been deleted or belongs to a private account.'}
          </p>
        </div>
      ) : (
        <PostCard
          post={post}
          currentUser={currentUser}
          onNavigate={onNavigate}
          onDeleted={() => onNavigate({ name: 'profile' })}
        />
      )}
    </main>
  );
}
