import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { loadPendingRegistration, clearPendingRegistration, useAuth } from '../../context/AuthContext';
import {
  createUserProfileAtomic,
  isUsernameAvailable,
  normalizeUsername,
  suggestUsername,
  validateBio,
  validateDisplayName,
  validateUsernameFormat,
} from '../../lib/userService';
import { BLUEPRINT_LIMITS } from '../../types/user';
import { Avatar } from '../Avatar';

export function OnboardingScreen() {
  const { firebaseUser } = useAuth();
  const pending = firebaseUser ? loadPendingRegistration(firebaseUser.uid) : null;

  const initialName =
    pending?.displayName ||
    firebaseUser?.displayName ||
    firebaseUser?.email?.split('@')[0] ||
    '';

  const initialHandle =
    pending?.username ||
    suggestUsername(
      firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'member',
      firebaseUser?.uid || '0000'
    );

  const [displayName, setDisplayName] = useState(initialName);
  const [username, setUsername] = useState(initialHandle);
  const [bio, setBio] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const [checkingHandle, setCheckingHandle] = useState(false);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeUsername(username);
  const formatError = validateUsernameFormat(normalized);

  useEffect(() => {
    if (formatError) {
      setHandleAvailable(null);
      return;
    }

    let cancelled = false;
    setCheckingHandle(true);
    const timer = window.setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(normalized);
        if (!cancelled) {
          setHandleAvailable(available);
        }
      } catch {
        if (!cancelled) {
          setHandleAvailable(null);
        }
      } finally {
        if (!cancelled) {
          setCheckingHandle(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [normalized, formatError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setError(null);

    const nameErr = validateDisplayName(displayName);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    if (formatError) {
      setError(formatError);
      return;
    }
    const bioErr = validateBio(bio);
    if (bioErr) {
      setError(bioErr);
      return;
    }

    setSubmitting(true);
    try {
      await createUserProfileAtomic({
        uid: firebaseUser.uid,
        username: normalized,
        displayName,
        bio,
        photoURL: firebaseUser.photoURL ?? '',
        isPrivate,
      });
      clearPendingRegistration(firebaseUser.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-4 pb-6 border-b border-zinc-200">
          <Avatar src={firebaseUser?.photoURL} name={displayName || 'User'} size="md" />
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-zinc-900">
              Complete your profile
            </h1>
            <p className="text-sm text-zinc-500">
              Choose a unique username to initialize your account.
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="onboard-name" className="block text-sm font-medium text-zinc-700 mb-1.5">
              Display name
            </label>
            <input
              id="onboard-name"
              type="text"
              required
              maxLength={BLUEPRINT_LIMITS.DISPLAY_NAME_MAX}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="onboard-username" className="block text-sm font-medium text-zinc-700 mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400 select-none">
                @
              </span>
              <input
                id="onboard-username"
                type="text"
                required
                maxLength={BLUEPRINT_LIMITS.USERNAME_MAX}
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                }
                placeholder="your_handle"
                className="w-full pl-8 pr-10 py-2.5 text-sm font-mono bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checkingHandle && <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />}
                {!checkingHandle && !formatError && handleAvailable === true && (
                  <Check className="w-4 h-4 text-emerald-600" />
                )}
              </div>
            </div>
            {formatError ? (
              <p className="mt-1 text-xs text-red-600">{formatError}</p>
            ) : handleAvailable === false ? (
              <p className="mt-1 text-xs text-red-600">@{normalized} is already taken.</p>
            ) : handleAvailable === true ? (
              <p className="mt-1 text-xs text-emerald-700">@{normalized} is available.</p>
            ) : (
              <p className="mt-1 text-xs text-zinc-400">
                Lowercase letters, numbers, and underscores only.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="onboard-bio" className="block text-sm font-medium text-zinc-700">
                Bio
              </label>
              <span className="text-xs font-mono tabular-nums text-zinc-400">
                {bio.length}/{BLUEPRINT_LIMITS.BIO_MAX}
              </span>
            </div>
            <textarea
              id="onboard-bio"
              rows={3}
              maxLength={BLUEPRINT_LIMITS.BIO_MAX}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people a little about yourself..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
            />
          </div>

          <label className="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <span className="block text-sm font-medium text-zinc-800">Private profile</span>
              <span className="block text-xs text-zinc-500">
                Hide your profile from public discovery lists.
              </span>
            </div>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 accent-zinc-900 rounded cursor-pointer"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || Boolean(formatError) || handleAvailable === false}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Creating profile...' : 'Save and continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
