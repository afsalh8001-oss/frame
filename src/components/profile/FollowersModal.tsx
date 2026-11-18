import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { listFollowers, listFollowing } from '../../lib/followService';
import { AppView, FollowerEdge, UserProfile } from '../../types/user';
import { Avatar } from '../Avatar';
import { FollowButton } from './FollowButton';

interface FollowersModalProps {
  targetUid: string;
  mode: 'followers' | 'following';
  currentUser: UserProfile;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
}

export function FollowersModal({
  targetUid,
  mode,
  currentUser,
  onClose,
  onNavigate,
}: FollowersModalProps) {
  const [rows, setRows] = useState<FollowerEdge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list =
          mode === 'followers'
            ? await listFollowers(targetUid)
            : await listFollowing(targetUid);
        if (active) setRows(list);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [targetUid, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const openUser = (uid: string) => {
    onClose();
    if (uid === currentUser.uid) {
      onNavigate({ name: 'profile' });
    } else {
      onNavigate({ name: 'user-profile', uid });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-zinc-900">
            {mode === 'followers' ? 'Followers' : 'Following'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-3 flex-1">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              {mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {rows.map((item) => (
                <li
                  key={item.uid}
                  className="px-3 py-3 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => openUser(item.uid)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <Avatar src={item.photoURL} name={item.displayName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate hover:underline">
                        {item.displayName}
                      </p>
                      <p className="text-xs font-mono text-zinc-500 truncate">
                        @{item.username}
                      </p>
                    </div>
                  </button>

                  {item.uid !== currentUser.uid && (
                    <FollowButton
                      currentUser={currentUser}
                      targetUid={item.uid}
                      compact
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
