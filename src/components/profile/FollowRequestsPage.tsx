import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Loader2, UserPlus, X } from 'lucide-react';
import {
  acceptFollowRequest,
  declineFollowRequest,
  listFollowRequests,
} from '../../lib/followService';
import { AppView, FollowRequest, UserProfile } from '../../types/user';
import { Avatar } from '../Avatar';

interface FollowRequestsPageProps {
  currentUser: UserProfile;
  onNavigate: (view: AppView) => void;
}

export function FollowRequestsPage({ currentUser, onNavigate }: FollowRequestsPageProps) {
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await listFollowRequests(currentUser.uid);
        if (active) setRequests(list);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentUser.uid]);

  const handleAccept = async (req: FollowRequest) => {
    setBusyUid(req.uid);
    try {
      await acceptFollowRequest(currentUser, req);
      setRequests((prev) => prev.filter((r) => r.uid !== req.uid));
    } finally {
      setBusyUid(null);
    }
  };

  const handleDecline = async (requesterUid: string) => {
    setBusyUid(requesterUid);
    try {
      await declineFollowRequest(currentUser.uid, requesterUid);
      setRequests((prev) => prev.filter((r) => r.uid !== requesterUid));
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <button
        type="button"
        onClick={() => onNavigate({ name: 'profile' })}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to profile
      </button>

      <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">
        Follow requests
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Approve or decline pending requests to follow your private account.
      </p>

      <div className="mt-6 bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-11 h-11 rounded-xl bg-zinc-100 text-zinc-500 flex items-center justify-center mx-auto mb-3">
              <UserPlus className="w-5 h-5" />
            </div>
            <h2 className="font-display text-base font-semibold text-zinc-900">
              No pending requests
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              When someone requests to follow you, they&apos;ll appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {requests.map((req) => {
              const busy = busyUid === req.uid;
              return (
                <li
                  key={req.uid}
                  className="p-4 sm:px-6 flex items-center justify-between gap-4"
                >
                  <button
                    type="button"
                    onClick={() => onNavigate({ name: 'user-profile', uid: req.uid })}
                    className="flex items-center gap-3.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <Avatar src={req.photoURL} name={req.displayName} size="md" />
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold text-zinc-900 truncate hover:underline">
                        {req.displayName}
                      </p>
                      <p className="text-xs font-mono text-zinc-500 truncate">
                        @{req.username}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleAccept(req)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDecline(req.uid)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Decline
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
