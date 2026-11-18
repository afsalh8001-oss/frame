import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  MessageCircle,
  Share2,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  checkPostLiked,
  checkPostSaved,
  deletePostAtomic,
  formatRelativeTime,
  togglePostLike,
  toggleSavePost,
} from '../../lib/postService';
import { AppView, Post, UserProfile } from '../../types/user';
import { Avatar } from '../Avatar';
import { CommentsSheet } from './CommentsSheet';
import { LikedByModal } from './LikedByModal';

interface PostCardProps {
  post: Post;
  currentUser: UserProfile;
  onNavigate: (view: AppView) => void;
  onDeleted?: (postId: string) => void;
}

export function PostCard({ post, currentUser, onNavigate, onDeleted }: PostCardProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [saved, setSaved] = useState(false);

  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showCommentsSheet, setShowCommentsSheet] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [isLiked, isSaved] = await Promise.all([
          checkPostLiked(post.postId, currentUser.uid),
          checkPostSaved(currentUser.uid, post.postId),
        ]);
        if (active) {
          setLiked(isLiked);
          setSaved(isSaved);
        }
      } catch {
        // Non-fatal
      }
    })();
    return () => {
      active = false;
    };
  }, [post.postId, currentUser.uid]);

  useEffect(() => {
    setLikesCount(post.likesCount);
    setCommentsCount(post.commentsCount);
  }, [post.likesCount, post.commentsCount]);

  const handleLikeToggle = async (forceLike?: boolean) => {
    const targetLiked = forceLike ?? !liked;
    if (forceLike && liked) {
      triggerHeartAnimation();
      return;
    }

    const prevLiked = liked;
    const prevCount = likesCount;
    const delta = targetLiked ? 1 : -1;

    setLiked(targetLiked);
    setLikesCount(Math.max(0, prevCount + delta));
    if (targetLiked) {
      triggerHeartAnimation();
    }

    try {
      await togglePostLike(post.postId, currentUser, targetLiked);
    } catch {
      setLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  const triggerHeartAnimation = () => {
    setShowHeartBurst(true);
    window.setTimeout(() => setShowHeartBurst(false), 700);
  };

  const handleMediaTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      void handleLikeToggle(true);
    }
    lastTapRef.current = now;
  };

  const handleSaveToggle = async () => {
    const prevSaved = saved;
    const nextSaved = !prevSaved;
    setSaved(nextSaved);

    try {
      await toggleSavePost(currentUser.uid, post, nextSaved);
    } catch {
      setSaved(prevSaved);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#/post/${post.postId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedNotice(true);
      window.setTimeout(() => setCopiedNotice(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `@${post.authorUsername} on Frame`,
          text: post.caption ? post.caption.slice(0, 120) : 'Check out this post on Frame',
          url: shareUrl,
        });
      } catch {
        // User dismissed native share sheet
      }
    }
  };

  const handleDeletePost = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deletePostAtomic(post);
      onDeleted?.(post.postId);
    } catch {
      setDeleting(false);
    }
  };

  const openAuthorProfile = () => {
    if (post.authorId === currentUser.uid) {
      onNavigate({ name: 'profile' });
    } else {
      onNavigate({ name: 'user-profile', uid: post.authorId });
    }
  };

  const renderCaptionWithHashtags = (text: string) => {
    const parts = text.split(/(#[a-zA-Z0-9_]{1,60})/g);
    return parts.map((part, idx) => {
      if (part.startsWith('#') && part.length > 1) {
        const tag = part.slice(1).toLowerCase();
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onNavigate({ name: 'hashtag', tag })}
            className="text-blue-600 hover:underline font-medium cursor-pointer"
          >
            {part}
          </button>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const needsTruncation = post.caption.length > 120;
  const visibleCaption =
    !captionExpanded && needsTruncation ? `${post.caption.slice(0, 120)}...` : post.caption;

  const images = post.imageURLs;

  return (
    <>
      <article className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        {/* Post Header */}
        <header className="px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={openAuthorProfile}
              className="cursor-pointer shrink-0"
            >
              <Avatar src={post.authorPhotoURL} name={post.authorUsername} size="sm" />
            </button>
            <div className="min-w-0">
              <button
                type="button"
                onClick={openAuthorProfile}
                className="font-display text-sm font-semibold text-zinc-900 hover:underline truncate block cursor-pointer"
              >
                @{post.authorUsername}
              </button>
              {post.location && (
                <p className="text-xs text-zinc-500 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{post.location}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-zinc-400">{formatRelativeTime(post.createdAt)}</span>
            {post.authorId === currentUser.uid && (
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeletePost}
                aria-label="Delete post"
                className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Image Carousel */}
        <div
          className="relative aspect-square bg-zinc-950 select-none overflow-hidden"
          onClick={handleMediaTap}
          onDoubleClick={() => void handleLikeToggle(true)}
        >
          {images[slideIndex] && (
            <img
              src={images[slideIndex]}
              alt={post.caption || `Post by @${post.authorUsername}`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          )}

          {/* Double-tap heart burst */}
          <AnimatePresence>
            {showHeartBurst && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.15, opacity: 1 }}
                exit={{ scale: 1.35, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <Heart className="w-20 h-20 fill-white text-white drop-shadow-lg" />
              </motion.div>
            )}
          </AnimatePresence>

          {images.length > 1 && (
            <>
              {slideIndex > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlideIndex((i) => Math.max(0, i - 1));
                  }}
                  aria-label="Previous slide"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-zinc-900 flex items-center justify-center shadow-sm cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              {slideIndex < images.length - 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlideIndex((i) => Math.min(images.length - 1, i + 1));
                  }}
                  aria-label="Next slide"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-zinc-900 flex items-center justify-center shadow-sm cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {/* Carousel indicator dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/45">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSlideIndex(idx);
                    }}
                    aria-label={`Slide ${idx + 1}`}
                    className={`w-1.5 h-1.5 rounded-full transition-colors cursor-pointer ${
                      idx === slideIndex ? 'bg-white' : 'bg-white/45'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Actions & Metadata */}
        <div className="px-4 pt-3.5 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => void handleLikeToggle()}
                aria-label={liked ? 'Unlike post' : 'Like post'}
                className="p-1 -ml-1 text-zinc-800 hover:text-zinc-500 transition-colors cursor-pointer"
              >
                <Heart
                  className={`w-6 h-6 transition-transform active:scale-90 ${
                    liked ? 'fill-red-500 text-red-500' : ''
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => setShowCommentsSheet(true)}
                aria-label="Comments"
                className="p-1 text-zinc-800 hover:text-zinc-500 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={handleShare}
                aria-label="Share post"
                className="p-1 text-zinc-800 hover:text-zinc-500 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                {copiedNotice ? (
                  <>
                    <Check className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-700">Link copied</span>
                  </>
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveToggle}
              aria-label={saved ? 'Remove bookmark' : 'Save post'}
              className="p-1 -mr-1 text-zinc-800 hover:text-zinc-500 transition-colors cursor-pointer"
            >
              <Bookmark
                className={`w-6 h-6 transition-colors ${
                  saved ? 'fill-zinc-900 text-zinc-900' : ''
                }`}
              />
            </button>
          </div>

          {/* Like count */}
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => setShowLikesModal(true)}
              className="text-sm font-semibold tabular-nums text-zinc-900 hover:underline cursor-pointer"
            >
              {likesCount} {likesCount === 1 ? 'like' : 'likes'}
            </button>
          </div>

          {/* Caption */}
          {post.caption && (
            <div className="mt-1.5 text-sm text-zinc-800 leading-relaxed break-words">
              <button
                type="button"
                onClick={openAuthorProfile}
                className="font-semibold text-zinc-900 hover:underline mr-1.5 cursor-pointer"
              >
                @{post.authorUsername}
              </button>
              <span className="whitespace-pre-line">{renderCaptionWithHashtags(visibleCaption)}</span>
              {needsTruncation && !captionExpanded && (
                <button
                  type="button"
                  onClick={() => setCaptionExpanded(true)}
                  className="ml-1.5 text-zinc-500 hover:text-zinc-900 font-medium cursor-pointer"
                >
                  more
                </button>
              )}
            </div>
          )}

          {/* Comment count */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowCommentsSheet(true)}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 cursor-pointer tabular-nums"
            >
              {commentsCount === 0
                ? 'Add a comment'
                : `View all ${commentsCount} ${commentsCount === 1 ? 'comment' : 'comments'}`}
            </button>
          </div>
        </div>
      </article>

      {showLikesModal && (
        <LikedByModal
          postId={post.postId}
          currentUid={currentUser.uid}
          onClose={() => setShowLikesModal(false)}
          onNavigate={onNavigate}
        />
      )}

      {showCommentsSheet && (
        <CommentsSheet
          post={post}
          currentUser={currentUser}
          onClose={() => setShowCommentsSheet(false)}
          onNavigate={onNavigate}
          onCommentsCountChange={(delta) =>
            setCommentsCount((prev) => Math.max(0, prev + delta))
          }
        />
      )}
    </>
  );
}
