import { useEffect, useState } from 'react';
import {
  cancelFollowRequest,
  followPublicUser,
  FollowStatus,
  getFollowStatus,
  sendFollowRequest,
  unfollowUser,
} from '../../lib/followService';
import { getUserProfile } from '../../lib/userService';
import { UserProfile } from '../../types/user';

interface FollowButtonProps {
  currentUser: UserProfile;
  targetUid: string;
  targetUser?: UserProfile;
  compact?: boolean;
  onStatusChange?: (status: FollowStatus, followerCountDelta: number) => void;
}

export function FollowButton({
  currentUser,
  targetUid,
  targetUser: initialTarget,
  compact = false,
  onStatusChange,
}: FollowButtonProps) {
  const [status, setStatus] = useState<FollowStatus>('none');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await getFollowStatus(currentUser.uid, targetUid);
        if (active) setStatus(s);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentUser.uid, targetUid]);

  if (currentUser.uid === targetUid) return null;

  const handleClick = async () => {
    if (busy || loading) return;
    setBusy(true);

    try {
      const target = initialTarget ?? (await getUserProfile(targetUid));
      if (!target) return;

      if (status === 'following') {
        await unfollowUser(currentUser.uid, target.uid);
        setStatus('none');
        onStatusChange?.('none', -1);
      } else if (status === 'requested') {
        await cancelFollowRequest(currentUser.uid, target.uid);
        setStatus('none');
        onStatusChange?.('none', 0);
      } else if (target.isPrivate) {
        await sendFollowRequest(currentUser, target.uid);
        setStatus('requested');
        onStatusChange?.('requested', 0);
      } else {
        await followPublicUser(currentUser, target);
        setStatus('following');
        onStatusChange?.('following', 1);
      }
    } finally {
      setBusy(false);
    }
  };

  const sizeClass = compact ? 'px-3.5 py-1.5 text-xs' : 'px-4 py-2 text-sm';

  if (loading) {
    return (
      <span
        className={`inline-block ${sizeClass} rounded-lg bg-zinc-100 text-zinc-400 whitespace-nowrap shrink-0`}
      >
        ...
      </span>
    );
  }

  if (status === 'following') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={handleClick}
        className={`${sizeClass} font-medium text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50`}
      >
        {busy ? 'Updating...' : 'Following'}
      </button>
    );
  }

  if (status === 'requested') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={handleClick}
        className={`${sizeClass} font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50`}
      >
        {busy ? 'Updating...' : 'Requested'}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleClick}
      className={`${sizeClass} font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50`}
    >
      {busy ? 'Following...' : 'Follow'}
    </button>
  );
}
