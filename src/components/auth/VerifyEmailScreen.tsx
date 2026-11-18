import { useState } from 'react';
import { AlertCircle, CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import { formatAuthError, useAuth } from '../../context/AuthContext';

export function VerifyEmailScreen() {
  const {
    firebaseUser,
    refreshVerificationStatus,
    resendVerificationEmail,
    signOutUser,
  } = useAuth();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    setError(null);
    setMessage(null);
    setChecking(true);
    try {
      const verified = await refreshVerificationStatus();
      if (!verified) {
        setMessage('Not verified yet. Please click the link in your inbox and try again.');
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setMessage(null);
    setResending(true);
    try {
      await resendVerificationEmail();
      setMessage('A new verification email has been sent to your inbox.');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8">
        <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5">
          <Mail className="w-5 h-5" />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">
          Verify your email
        </h1>
        <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
          We sent a verification link to{' '}
          <span className="font-medium text-zinc-900">{firebaseUser?.email}</span>. Open the link
          to activate your account and create your profile.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="mt-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-700">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-zinc-600" />
            <span>{message}</span>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={checking}
            onClick={handleCheck}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking status...' : "I've verified my email"}
          </button>

          <button
            type="button"
            disabled={resending}
            onClick={handleResend}
            className="w-full px-4 py-2.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {resending ? 'Sending...' : 'Resend verification email'}
          </button>

          <button
            type="button"
            onClick={signOutUser}
            className="w-full px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 cursor-pointer"
          >
            Sign out and use another account
          </button>
        </div>
      </div>
    </div>
  );
}
