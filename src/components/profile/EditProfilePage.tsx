import React, { useEffect, useRef, useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { AlertCircle, ArrowLeft, Camera, Check, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { auth } from '../../lib/firebase';
import {
  isUsernameAvailable,
  normalizeUsername,
  updateUserProfileAtomic,
  uploadProfilePhoto,
  validateBio,
  validateDisplayName,
  validateUsernameFormat,
} from '../../lib/userService';
import { AppView, BLUEPRINT_LIMITS, UserProfile } from '../../types/user';
import { Avatar } from '../Avatar';

interface EditProfilePageProps {
  profile: UserProfile;
  onNavigate: (view: AppView) => void;
}

export function EditProfilePage({ profile, onNavigate }: EditProfilePageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [photoURL, setPhotoURL] = useState(profile.photoURL);
  const [isPrivate, setIsPrivate] = useState(profile.isPrivate);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [checkingHandle, setCheckingHandle] = useState(false);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const normalized = normalizeUsername(username);
  const usernameChanged = normalized !== profile.username;
  const formatError = validateUsernameFormat(normalized);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!usernameChanged) {
      setHandleAvailable(true);
      setCheckingHandle(false);
      return;
    }
    if (formatError) {
      setHandleAvailable(null);
      setCheckingHandle(false);
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
  }, [normalized, usernameChanged, formatError]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSavedNotice(false);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photo must be smaller than 5 MB.');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setSavedNotice(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setPhotoURL('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(false);

    const nameErr = validateDisplayName(displayName);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    if (formatError) {
      setError(formatError);
      return;
    }
    if (usernameChanged && handleAvailable === false) {
      setError(`The username @${normalized} is already taken.`);
      return;
    }
    const bioErr = validateBio(bio);
    if (bioErr) {
      setError(bioErr);
      return;
    }

    setSaving(true);
    try {
      let nextPhotoURL = photoURL;
      if (selectedFile) {
        setUploadProgress(0);
        nextPhotoURL = await uploadProfilePhoto(profile.uid, selectedFile, (pct) => {
          setUploadProgress(pct);
        });
        setPhotoURL(nextPhotoURL);
        setSelectedFile(null);
      }

      await updateUserProfileAtomic({
        uid: profile.uid,
        currentUsername: profile.username,
        nextUsername: normalized,
        displayName,
        bio,
        photoURL: nextPhotoURL,
        isPrivate,
      });

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: displayName.trim(),
          photoURL: nextPhotoURL || null,
        });
      }

      setUploadProgress(null);
      setSavedNotice(true);
      onNavigate({ name: 'profile' });
    } catch (err) {
      setUploadProgress(null);
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const displayedAvatar = previewUrl ?? photoURL;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'profile' })}
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to profile
          </button>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">
            Edit profile
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Update your photo, public name, handle, and bio.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-6"
      >
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {savedNotice && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Profile changes saved.</span>
          </div>
        )}

        {/* Photo upload section */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-zinc-200">
          <Avatar src={displayedAvatar} name={displayName || profile.displayName} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900">Profile photo</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              JPG, PNG, or WebP up to 5 MB. Uploaded to Firebase Storage.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                {displayedAvatar ? 'Change photo' : 'Upload photo'}
              </button>
              {displayedAvatar && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
            </div>
            {uploadProgress !== null && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                  <span>Uploading photo...</span>
                  <span className="font-mono tabular-nums">{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Display Name */}
        <div>
          <label htmlFor="edit-name" className="block text-sm font-medium text-zinc-700 mb-1.5">
            Name
          </label>
          <input
            id="edit-name"
            type="text"
            required
            maxLength={BLUEPRINT_LIMITS.DISPLAY_NAME_MAX}
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setSavedNotice(false);
            }}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>

        {/* Username */}
        <div>
          <label htmlFor="edit-username" className="block text-sm font-medium text-zinc-700 mb-1.5">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400 select-none">
              @
            </span>
            <input
              id="edit-username"
              type="text"
              required
              maxLength={BLUEPRINT_LIMITS.USERNAME_MAX}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                setSavedNotice(false);
              }}
              className="w-full pl-8 pr-10 py-2.5 text-sm font-mono bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {checkingHandle && <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />}
              {!checkingHandle && usernameChanged && !formatError && handleAvailable === true && (
                <Check className="w-4 h-4 text-emerald-600" />
              )}
            </div>
          </div>
          {formatError ? (
            <p className="mt-1 text-xs text-red-600">{formatError}</p>
          ) : usernameChanged && handleAvailable === false ? (
            <p className="mt-1 text-xs text-red-600">@{normalized} is already taken.</p>
          ) : usernameChanged && handleAvailable === true ? (
            <p className="mt-1 text-xs text-emerald-700">@{normalized} is available.</p>
          ) : (
            <p className="mt-1 text-xs text-zinc-400">
              Changing your username releases your previous handle immediately.
            </p>
          )}
        </div>

        {/* Bio */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="edit-bio" className="block text-sm font-medium text-zinc-700">
              Bio
            </label>
            <span className="text-xs font-mono tabular-nums text-zinc-400">
              {bio.length}/{BLUEPRINT_LIMITS.BIO_MAX}
            </span>
          </div>
          <textarea
            id="edit-bio"
            rows={4}
            maxLength={BLUEPRINT_LIMITS.BIO_MAX}
            value={bio}
            onChange={(e) => {
              setBio(e.target.value);
              setSavedNotice(false);
            }}
            placeholder="Write a short bio..."
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
          />
        </div>

        {/* Privacy toggle */}
        <label className="flex items-center justify-between pt-2 pb-1 cursor-pointer">
          <div>
            <span className="block text-sm font-medium text-zinc-800">Private account</span>
            <span className="block text-xs text-zinc-500">
              Exclude your profile from public directory queries.
            </span>
          </div>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => {
              setIsPrivate(e.target.checked);
              setSavedNotice(false);
            }}
            className="w-4 h-4 accent-zinc-900 rounded cursor-pointer"
          />
        </label>

        {/* Actions */}
        <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => onNavigate({ name: 'profile' })}
            className="px-4 py-2.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              saving ||
              Boolean(formatError) ||
              (usernameChanged && (checkingHandle || handleAvailable === false))
            }
            className="px-5 py-2.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {saving ? 'Saving changes...' : 'Save changes'}
          </button>
        </div>
      </form>
    </main>
  );
}
