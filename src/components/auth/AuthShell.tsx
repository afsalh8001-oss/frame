import React from 'react';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Left editorial column */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-between pr-6">
          <div>
            <span className="font-display text-lg font-bold tracking-tight text-zinc-900">
              Frame
            </span>
            <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight text-zinc-900 leading-[1.15] text-balance">
              A quiet space for your visual work and profile.
            </h1>
            <p className="mt-4 text-base text-zinc-600 leading-relaxed max-w-md">
              Claim your handle, curate your public or private presence, and keep your portfolio organized in a clean grid.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-3 max-w-md">
            <div className="aspect-square rounded-xl bg-zinc-100 border border-zinc-200/80" />
            <div className="aspect-square rounded-xl bg-zinc-200/60 border border-zinc-200/80" />
            <div className="aspect-square rounded-xl bg-zinc-100 border border-zinc-200/80" />
            <div className="aspect-square rounded-xl bg-zinc-200/60 border border-zinc-200/80" />
            <div className="aspect-square rounded-xl bg-white border border-zinc-200 flex items-center justify-center">
              <span className="font-mono text-xs text-zinc-400">01</span>
            </div>
            <div className="aspect-square rounded-xl bg-zinc-100 border border-zinc-200/80" />
          </div>
        </div>

        {/* Right form container */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto lg:max-w-none">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8">
            <div className="lg:hidden mb-6">
              <span className="font-display text-lg font-bold tracking-tight text-zinc-900">
                Frame
              </span>
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">
              {title}
            </h2>
            <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
