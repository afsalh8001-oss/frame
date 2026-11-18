import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { formatAuthError, useAuth } from '../../context/AuthContext';
import { AuthScreen } from '../../types/user';
import { AuthShell } from './AuthShell';

interface ResetPasswordScreenProps {
  onSwitch: (screen: AuthScreen) => void;
}

export function ResetPasswordScreen({ onSwitch }: ResetPasswordScreenProps) {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email associated with your account and we'll send a reset link."
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

      {sent ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium">Reset link sent</p>
              <p className="mt-1 text-emerald-700">
                Check <span className="font-medium">{email}</span> for instructions to choose a new password.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSwitch('login')}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reset-email" className="block text-sm font-medium text-zinc-700 mb-1.5">
              Email address
            </label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Sending reset link...' : 'Send reset link'}
          </button>

          <button
            type="button"
            onClick={() => onSwitch('login')}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </button>
        </form>
      )}
    </AuthShell>
  );
}
