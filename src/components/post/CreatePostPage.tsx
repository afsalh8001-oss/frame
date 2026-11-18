import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  MapPin,
  Trash2,
} from 'lucide-react';
import {
  createPostAtomic,
  generateId,
  parseHashtags,
  uploadPostImages,
} from '../../lib/postService';
import { AppView, BLUEPRINT_LIMITS, UserProfile } from '../../types/user';

interface SelectedImage {
  id: string;
  file: File;
  previewUrl: string;
}

interface CreatePostPageProps {
  currentUser: UserProfile;
  onNavigate: (view: AppView) => void;
}

export function CreatePostPage({ currentUser, onNavigate }: CreatePostPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const remainingSlots = BLUEPRINT_LIMITS.POST_MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setError(`You can upload up to ${BLUEPRINT_LIMITS.POST_MAX_IMAGES} images per post.`);
      return;
    }

    const validFiles: SelectedImage[] = [];
    for (const file of files.slice(0, remainingSlots)) {
      if (!file.type.startsWith('image/')) {
        setError(`"${file.name}" is not an image file.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`"${file.name}" exceeds the 10 MB limit.`);
        continue;
      }
      validFiles.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (files.length > remainingSlots) {
      setError(`Only the first ${remainingSlots} image(s) were added (max 10 per post).`);
    }

    setImages((prev) => {
      const next = [...prev, ...validFiles];
      if (prev.length === 0 && next.length > 0) {
        setActiveSlide(0);
      }
      return next;
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setError(null);
    setImages((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((_, idx) => idx !== index);
      if (activeSlide >= next.length) {
        setActiveSlide(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (images.length === 0) {
      setError('Please select at least 1 image to post.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const postId = generateId();
      const files = images.map((img) => img.file);
      const imageURLs = await uploadPostImages(
        currentUser.uid,
        postId,
        files,
        (pct) => setUploadProgress(pct)
      );

      await createPostAtomic({
        postId,
        author: currentUser,
        imageURLs,
        caption,
        location,
      });

      onNavigate({ name: 'profile' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish post.');
    } finally {
      setUploading(false);
    }
  };

  const detectedHashtags = parseHashtags(caption);
  const currentImage = images[activeSlide];

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'feed' })}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">
            Create post
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Select 1 to 10 photos, add a caption, and share with your followers.
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleSelectFiles}
          className="hidden"
        />

        {/* Preview Carousel or Empty Picker */}
        {images.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-[4/3] sm:aspect-[16/10] rounded-xl border border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100/70 transition-colors flex flex-col items-center justify-center p-6 text-center cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-700 mb-3">
              <ImagePlus className="w-5 h-5" />
            </div>
            <p className="font-display text-sm font-semibold text-zinc-900">
              Select photos to upload
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Choose 1 to 10 images (JPG, PNG, WebP up to 10 MB each)
            </p>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="relative aspect-square sm:aspect-[4/3] w-full rounded-xl overflow-hidden bg-zinc-950 border border-zinc-200">
              {currentImage && (
                <img
                  src={currentImage.previewUrl}
                  alt={`Selected slide ${activeSlide + 1}`}
                  className="w-full h-full object-contain"
                />
              )}

              {/* Remove current image button */}
              <button
                type="button"
                disabled={uploading}
                onClick={() => handleRemoveImage(activeSlide)}
                aria-label="Remove current image"
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-black/70 hover:bg-black/85 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>

              {/* Slide counter */}
              <span className="absolute top-3 left-3 px-2.5 py-1 text-xs font-mono tabular-nums text-white bg-black/70 rounded-lg">
                {activeSlide + 1} / {images.length}
              </span>

              {/* Prev / Next arrows */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    disabled={activeSlide === 0}
                    onClick={() => setActiveSlide((s) => Math.max(0, s - 1))}
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-zinc-900 flex items-center justify-center shadow-sm transition-opacity disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    disabled={activeSlide === images.length - 1}
                    onClick={() => setActiveSlide((s) => Math.min(images.length - 1, s + 1))}
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-zinc-900 flex items-center justify-center shadow-sm transition-opacity disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Carousel dots + add more */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveSlide(idx)}
                    aria-label={`View image ${idx + 1}`}
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                      idx === activeSlide
                        ? 'border-zinc-900 opacity-100'
                        : 'border-transparent opacity-60 hover:opacity-90'
                    }`}
                  >
                    <img
                      src={img.previewUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>

              {images.length < BLUEPRINT_LIMITS.POST_MAX_IMAGES && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Add more ({images.length}/{BLUEPRINT_LIMITS.POST_MAX_IMAGES})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Caption */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="post-caption" className="block text-sm font-medium text-zinc-700">
              Caption
            </label>
            <span className="text-xs font-mono tabular-nums text-zinc-400">
              {caption.length}/{BLUEPRINT_LIMITS.CAPTION_MAX}
            </span>
          </div>
          <textarea
            id="post-caption"
            rows={4}
            maxLength={BLUEPRINT_LIMITS.CAPTION_MAX}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption... Include #hashtags to categorize your post."
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
          />
          {detectedHashtags.length > 0 && (
            <p className="mt-1.5 text-xs text-zinc-500">
              Hashtags:{' '}
              <span className="font-mono text-zinc-700">
                {detectedHashtags.map((t) => `#${t}`).join('  ')}
              </span>
            </p>
          )}
        </div>

        {/* Location */}
        <div>
          <label htmlFor="post-location" className="block text-sm font-medium text-zinc-700 mb-1.5">
            Location <span className="text-zinc-400 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="post-location"
              type="text"
              maxLength={BLUEPRINT_LIMITS.LOCATION_MAX}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Tokyo, Japan"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
        </div>

        {uploading && (
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
              <span>Uploading images & publishing post...</span>
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

        <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={uploading}
            onClick={() => onNavigate({ name: 'feed' })}
            className="px-4 py-2.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading || images.length === 0}
            className="px-5 py-2.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {uploading ? 'Publishing...' : 'Share post'}
          </button>
        </div>
      </form>
    </main>
  );
}
