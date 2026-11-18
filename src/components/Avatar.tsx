import { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-24 h-24 sm:w-28 sm:h-28 text-2xl',
  xl: 'w-28 h-28 sm:w-32 sm:h-32 text-3xl',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src && src !== failedSrc);

  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden bg-zinc-100 border border-zinc-200 flex items-center justify-center select-none ${SIZE_CLASSES[size]} ${className}`}
    >
      {showImage ? (
        <img
          src={src ?? ''}
          alt={`${name} avatar`}
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src ?? null)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="font-display font-semibold text-zinc-600 tracking-tight">
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}
