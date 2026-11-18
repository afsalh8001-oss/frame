import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { formatAuthError, useAuth } from '../../context/AuthContext';
import { AuthScreen } from '../../types/user';
import { AuthShell } from './AuthShell';
import { GoogleIcon } from './GoogleIcon';

interface LoginScreenProps {
  onSwitch: (screen: AuthScreen) => void;
}

export function LoginScreen({ onSwitch }: LoginScreenProps) {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Enter your credentials to access your profile."
    >
      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading || googleLoading}
        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-medium text-zinc-800 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <GoogleIcon />
        <span>{googleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
      </button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-zinc-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-zinc-400">or continue with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-zinc-700 mb-1.5">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="login-password" className="block text-sm font-medium text-zinc-700">
              Password
            </label>
            <button
              type="button"
              onClick={() => onSwitch('reset-password')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={() => onSwitch('signup')}
          className="font-medium text-zinc-900 hover:underline cursor-pointer"
        >
          Create one
        </button>
      </p>
    </AuthShell>
  );
}
