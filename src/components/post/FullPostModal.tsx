import { useEffect } from 'react';
import { X } from 'lucide-react';
import { AppView, Post, UserProfile } from '../../types/user';
import { PostCard } from './PostCard';

interface FullPostModalProps {
  post: Post;
  currentUser: UserProfile;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onDeleted?: (postId: string) => void;
}

export function FullPostModal({
  post,
  currentUser,
  onClose,
  onNavigate,
  onDeleted,
}: FullPostModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] overflow-y-auto p-4 sm:p-6 flex items-start justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl my-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-2.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close post view"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-black/70 hover:bg-black rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </div>

        <PostCard
          post={post}
          currentUser={currentUser}
          onNavigate={(view) => {
            onClose();
            onNavigate(view);
          }}
          onDeleted={(postId) => {
            onDeleted?.(postId);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
