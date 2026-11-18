/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopBar } from './components/TopBar';
import { LoginScreen } from './components/auth/LoginScreen';
import { SignUpScreen } from './components/auth/SignUpScreen';
import { ResetPasswordScreen } from './components/auth/ResetPasswordScreen';
import { VerifyEmailScreen } from './components/auth/VerifyEmailScreen';
import { OnboardingScreen } from './components/auth/OnboardingScreen';
import { HomeFeedPage } from './components/feed/HomeFeedPage';
import { CreatePostPage } from './components/post/CreatePostPage';
import { HashtagPage } from './components/post/HashtagPage';
import { PostDetailPage } from './components/post/PostDetailPage';
import { ProfilePage } from './components/profile/ProfilePage';
import { EditProfilePage } from './components/profile/EditProfilePage';
import { ExplorePage } from './components/profile/ExplorePage';
import { FollowRequestsPage } from './components/profile/FollowRequestsPage';
import { getUserProfile } from './lib/userService';
import { AppView, AuthScreen, UserProfile } from './types/user';

function parseHash(): AppView {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash === '/signup') return { name: 'signup' };
  if (hash === '/reset-password') return { name: 'reset-password' };
  if (hash === '/verify-email') return { name: 'verify-email' };
  if (hash === '/onboarding') return { name: 'onboarding' };
  if (hash === '/feed') return { name: 'feed' };
  if (hash === '/create') return { name: 'create-post' };
  if (hash === '/edit-profile') return { name: 'edit-profile' };
  if (hash === '/follow-requests') return { name: 'follow-requests' };
  if (hash === '/explore') return { name: 'explore' };
  if (hash === '/profile') return { name: 'profile' };
  if (hash.startsWith('/user/')) {
    const uid = hash.slice('/user/'.length).trim();
    if (uid) return { name: 'user-profile', uid };
  }
  if (hash.startsWith('/tag/')) {
    const tag = decodeURIComponent(hash.slice('/tag/'.length).trim());
    if (tag) return { name: 'hashtag', tag };
  }
  if (hash.startsWith('/post/')) {
    const postId = hash.slice('/post/'.length).trim();
    if (postId) return { name: 'post', postId };
  }
  return { name: 'login' };
}

function viewToHash(view: AppView): string {
  switch (view.name) {
    case 'login':
      return '#/login';
    case 'signup':
      return '#/signup';
    case 'reset-password':
      return '#/reset-password';
    case 'verify-email':
      return '#/verify-email';
    case 'onboarding':
      return '#/onboarding';
    case 'feed':
      return '#/feed';
    case 'create-post':
      return '#/create';
    case 'profile':
      return '#/profile';
    case 'edit-profile':
      return '#/edit-profile';
    case 'follow-requests':
      return '#/follow-requests';
    case 'explore':
      return '#/explore';
    case 'user-profile':
      return `#/user/${view.uid}`;
    case 'hashtag':
      return `#/tag/${encodeURIComponent(view.tag)}`;
    case 'post':
      return `#/post/${view.postId}`;
  }
}

function PublicProfileViewer({
  uid,
  currentUser,
  onNavigate,
}: {
  uid: string;
  currentUser: UserProfile;
  onNavigate: (view: AppView) => void;
}) {
  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const fetched = await getUserProfile(uid);
        if (active) {
          setTargetProfile(fetched);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [uid]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (!targetProfile) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="font-display text-xl font-semibold text-zinc-900">Profile not found</h1>
        <p className="mt-2 text-sm text-zinc-500">
          This user profile does not exist or could not be loaded.
        </p>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'explore' })}
          className="mt-6 px-4 py-2 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
        >
          Back to Explore
        </button>
      </main>
    );
  }

  return (
    <ProfilePage
      profile={targetProfile}
      currentUser={currentUser}
      isOwnProfile={targetProfile.uid === currentUser.uid}
      onNavigate={onNavigate}
    />
  );
}

function AppRouter() {
  const { firebaseUser, profile, authReady, profileLoading, signOutUser } = useAuth();
  const [view, setView] = useState<AppView>(() => parseHash());

  const navigate = useCallback((next: AppView) => {
    const targetHash = viewToHash(next);
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
    setView(next);
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setView(parseHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (!firebaseUser) {
      if (view.name !== 'login' && view.name !== 'signup' && view.name !== 'reset-password') {
        navigate({ name: 'login' });
      }
      return;
    }

    if (profileLoading) return;

    if (!profile) {
      if (!firebaseUser.emailVerified) {
        if (view.name !== 'verify-email') {
          navigate({ name: 'verify-email' });
        }
      } else if (view.name !== 'onboarding') {
        navigate({ name: 'onboarding' });
      }
      return;
    }

    if (
      view.name === 'login' ||
      view.name === 'signup' ||
      view.name === 'reset-password' ||
      view.name === 'verify-email' ||
      view.name === 'onboarding'
    ) {
      navigate({ name: 'feed' });
    }
  }, [authReady, firebaseUser, profile, profileLoading, view.name, navigate]);

  if (!authReady || (firebaseUser && profileLoading)) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
          <span className="text-sm text-zinc-500">Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    const handleAuthSwitch = (screen: AuthScreen) => {
      navigate({ name: screen });
    };

    if (view.name === 'signup') {
      return <SignUpScreen onSwitch={handleAuthSwitch} />;
    }
    if (view.name === 'reset-password') {
      return <ResetPasswordScreen onSwitch={handleAuthSwitch} />;
    }
    return <LoginScreen onSwitch={handleAuthSwitch} />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <TopBar
        currentView={view}
        onNavigate={navigate}
        onSignOut={signOutUser}
        hasProfile={Boolean(profile)}
      />

      {!profile ? (
        !firebaseUser.emailVerified ? (
          <VerifyEmailScreen />
        ) : (
          <OnboardingScreen />
        )
      ) : view.name === 'create-post' ? (
        <CreatePostPage currentUser={profile} onNavigate={navigate} />
      ) : view.name === 'edit-profile' ? (
        <EditProfilePage profile={profile} onNavigate={navigate} />
      ) : view.name === 'follow-requests' ? (
        <FollowRequestsPage currentUser={profile} onNavigate={navigate} />
      ) : view.name === 'explore' ? (
        <ExplorePage currentUser={profile} onNavigate={navigate} />
      ) : view.name === 'hashtag' ? (
        <HashtagPage tag={view.tag} currentUser={profile} onNavigate={navigate} />
      ) : view.name === 'post' ? (
        <PostDetailPage postId={view.postId} currentUser={profile} onNavigate={navigate} />
      ) : view.name === 'user-profile' ? (
        <PublicProfileViewer
          uid={view.uid}
          currentUser={profile}
          onNavigate={navigate}
        />
      ) : view.name === 'profile' ? (
        <ProfilePage
          profile={profile}
          currentUser={profile}
          isOwnProfile
          onNavigate={navigate}
        />
      ) : (
        <HomeFeedPage currentUser={profile} onNavigate={navigate} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}
