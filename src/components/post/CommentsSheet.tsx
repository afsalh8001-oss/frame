import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Loader2, Send, Trash2, X } from 'lucide-react';
import {
  addPostComment,
  checkCommentLikes,
  deletePostComment,
  formatRelativeTime,
  listPostComments,
  toggleCommentLike,
} from '../../lib/postService';
import { AppView, BLUEPRINT_LIMITS, CommentItem, Post, UserProfile } from '../../types/user';
import { Avatar } from '../Avatar';

interface CommentsSheetProps {
  post: Post;
  currentUser: UserProfile;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onCommentsCountChange: (delta: number) => void;
}

export function CommentsSheet({
  post,
  currentUser,
  onClose,
  onNavigate,
  onCommentsCountChange,
}: CommentsSheetProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const [text, setText] = useState('');
  const [replyTarget, setReplyTarget] = useState<{
    parentId: string;
    username: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await listPostComments(post.postId);
        if (!active) return;
        setComments(list);
        const likes = await checkCommentLikes(
          post.postId,
          list.map((c) => c.commentId),
          currentUser.uid
        );
        if (active) setLikedMap(likes);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [post.postId, currentUser.uid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { topLevel, repliesByParent } = useMemo(() => {
    const parents: CommentItem[] = [];
    const replies: Record<string, CommentItem[]> = {};
    for (const c of comments) {
      if (!c.parentId) {
        parents.push(c);
      } else {
        if (!replies[c.parentId]) replies[c.parentId] = [];
        replies[c.parentId].push(c);
      }
    }
    return { topLevel: parents, repliesByParent: replies };
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || submitting) return;

    setSubmitting(true);
    try {
      const parentId = replyTarget?.parentId ?? '';
      const created = await addPostComment({
        postId: post.postId,
        currentUser,
        text,
        parentId,
      });
      setComments((prev) => [...prev, created]);
      if (parentId) {
        setExpandedReplies((prev) => ({ ...prev, [parentId]: true }));
      }
      setText('');
      setReplyTarget(null);
      onCommentsCountChange(1);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (comment: CommentItem) => {
    const directReplies = comment.parentId ? [] : repliesByParent[comment.commentId] ?? [];
    const replyIds = directReplies.map((r) => r.commentId);

    setComments((prev) =>
      prev.filter((c) => c.commentId !== comment.commentId && !replyIds.includes(c.commentId))
    );
    onCommentsCountChange(-(1 + replyIds.length));

    try {
      await deletePostComment({
        postId: post.postId,
        commentId: comment.commentId,
        replyIds,
      });
    } catch {
      const refreshed = await listPostComments(post.postId);
      setComments(refreshed);
    }
  };

  const handleToggleLike = async (comment: CommentItem) => {
    const currentlyLiked = Boolean(likedMap[comment.commentId]);
    const nextLiked = !currentlyLiked;

    setLikedMap((prev) => ({ ...prev, [comment.commentId]: nextLiked }));
    setComments((prev) =>
      prev.map((c) =>
        c.commentId === comment.commentId
          ? { ...c, likesCount: Math.max(0, c.likesCount + (nextLiked ? 1 : -1)) }
          : c
      )
    );

    try {
      await toggleCommentLike(post.postId, comment.commentId, currentUser.uid, nextLiked);
    } catch {
      setLikedMap((prev) => ({ ...prev, [comment.commentId]: currentlyLiked }));
      setComments((prev) =>
        prev.map((c) =>
          c.commentId === comment.commentId
            ? { ...c, likesCount: Math.max(0, c.likesCount + (currentlyLiked ? 1 : -1)) }
            : c
        )
      );
    }
  };

  const goToAuthor = (uid: string) => {
    onClose();
    if (uid === currentUser.uid) {
      onNavigate({ name: 'profile' });
    } else {
      onNavigate({ name: 'user-profile', uid });
    }
  };

  const renderCommentRow = (comment: CommentItem, topLevelParentId: string, isReply = false) => {
    const canDelete =
      comment.authorId === currentUser.uid || post.authorId === currentUser.uid;
    const isLiked = Boolean(likedMap[comment.commentId]);

    return (
      <div
        key={comment.commentId}
        className={`flex items-start gap-3 ${isReply ? 'pl-10 pt-3' : 'py-3'}`}
      >
        <button
          type="button"
          onClick={() => goToAuthor(comment.authorId)}
          className="cursor-pointer shrink-0"
        >
          <Avatar src={comment.photoURL} name={comment.username} size="sm" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-800 leading-snug break-words">
            <button
              type="button"
              onClick={() => goToAuthor(comment.authorId)}
              className="font-semibold text-zinc-900 hover:underline mr-1.5 cursor-pointer"
            >
              @{comment.username}
            </button>
            <span>{comment.text}</span>
          </p>

          <div className="mt-1.5 flex items-center gap-4 text-xs text-zinc-400">
            <span>{formatRelativeTime(comment.createdAt)}</span>
            {comment.likesCount > 0 && (
              <span className="font-mono tabular-nums text-zinc-500">
                {comment.likesCount} {comment.likesCount === 1 ? 'like' : 'likes'}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setReplyTarget({
                  parentId: topLevelParentId,
                  username: comment.username,
                });
                setText(`@${comment.username} `);
                inputRef.current?.focus();
              }}
              className="font-medium text-zinc-500 hover:text-zinc-900 cursor-pointer"
            >
              Reply
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => handleDelete(comment)}
                aria-label="Delete comment"
                className="text-zinc-400 hover:text-red-600 cursor-pointer inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleToggleLike(comment)}
          aria-label={isLiked ? 'Unlike comment' : 'Like comment'}
          className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer shrink-0"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              isLiked ? 'fill-red-500 text-red-500' : ''
            }`}
          />
        </button>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white border border-zinc-200 rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[85vh] h-[75vh] sm:h-[640px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sheet Header */}
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between shrink-0">
          <h2 className="font-display text-base font-semibold text-zinc-900">Comments</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-5 py-2 divide-y divide-zinc-100">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
            </div>
          ) : topLevel.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-display text-sm font-semibold text-zinc-900">No comments yet</p>
              <p className="mt-1 text-xs text-zinc-500">Start the conversation below.</p>
            </div>
          ) : (
            topLevel.map((parent) => {
              const replies = repliesByParent[parent.commentId] ?? [];
              const showReplies = Boolean(expandedReplies[parent.commentId]);

              return (
                <div key={parent.commentId} className="py-1">
                  {renderCommentRow(parent, parent.commentId, false)}

                  {replies.length > 0 && (
                    <div className="pl-12 pb-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedReplies((prev) => ({
                            ...prev,
                            [parent.commentId]: !prev[parent.commentId],
                          }))
                        }
                        className="text-xs font-medium text-zinc-500 hover:text-zinc-900 cursor-pointer"
                      >
                        {showReplies
                          ? 'Hide replies'
                          : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                      </button>

                      {showReplies && (
                        <div className="mt-1">
                          {replies.map((reply) =>
                            renderCommentRow(reply, parent.commentId, true)
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Input */}
        <div className="border-t border-zinc-200 bg-white px-4 py-3 shrink-0">
          {replyTarget && (
            <div className="mb-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg flex items-center justify-between text-xs text-zinc-600">
              <span>
                Replying to <span className="font-medium text-zinc-900">@{replyTarget.username}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setReplyTarget(null);
                  setText('');
                }}
                className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center gap-2.5">
            <Avatar src={currentUser.photoURL} name={currentUser.displayName} size="sm" />
            <input
              ref={inputRef}
              type="text"
              maxLength={BLUEPRINT_LIMITS.COMMENT_MAX}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                replyTarget ? `Reply to @${replyTarget.username}...` : 'Add a comment...'
              }
              className="flex-1 px-3.5 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
            <button
              type="submit"
              disabled={!text.trim() || submitting}
              aria-label="Post comment"
              className="p-2.5 text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer disabled:opacity-40 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
