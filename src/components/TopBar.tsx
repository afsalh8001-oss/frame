import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AppView } from '../types/user';

interface TopBarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onSignOut: () => Promise<void>;
  hasProfile: boolean;
}

export function TopBar({ currentView, onNavigate, onSignOut, hasProfile }: TopBarProps) {
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-zinc-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate(hasProfile ? { name: 'feed' } : { name: 'onboarding' })}
          className="font-display text-lg font-bold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          Frame
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        {hasProfile ? (
          <nav className="flex items-center gap-3 sm:gap-6 text-sm font-medium overflow-x-auto">
            <button
              type="button"
              onClick={() => onNavigate({ name: 'feed' })}
              className={`whitespace-nowrap shrink-0 cursor-pointer py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
                currentView.name === 'feed'
                  ? 'text-zinc-900 underline underline-offset-8 decoration-2 decoration-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Feed
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'explore' })}
              className={`whitespace-nowrap shrink-0 cursor-pointer py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
                currentView.name === 'explore' || currentView.name === 'hashtag'
                  ? 'text-zinc-900 underline underline-offset-8 decoration-2 decoration-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Explore
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'create-post' })}
              aria-label="Create post"
              className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
                currentView.name === 'create-post'
                  ? 'text-zinc-900 underline underline-offset-8 decoration-2 decoration-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Create</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'profile' })}
              className={`whitespace-nowrap shrink-0 cursor-pointer py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
                currentView.name === 'profile' ||
                currentView.name === 'edit-profile' ||
                currentView.name === 'follow-requests'
                  ? 'text-zinc-900 underline underline-offset-8 decoration-2 decoration-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Profile
            </button>
          </nav>
        ) : (
          <div className="flex-1" />
        )}

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            disabled={signingOut}
            onClick={handleSignOut}
            className="px-3.5 sm:px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </div>
    </header>
  );
}
