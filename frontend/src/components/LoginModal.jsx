import React, { useState } from 'react';
import { X, Shield, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LoginModal = ({ onClose, onSuccess, allowSkip = true }) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (mode === 'login') {
        result = await login(email, password);
      } else {
        result = await register(email, password, firstName, lastName);
      }
      
      if (result.success) {
        onSuccess?.();
        onClose?.();
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Allow users to skip login and use app without auth
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 p-8 bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700/50 rounded-2xl shadow-2xl">
        {/* Security badge */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex items-center gap-2 text-sm font-medium shadow-lg">
          <Shield className="w-4 h-4" />
          Federal-Grade Security
        </div>

        {/* Close button - only show if allowSkip */}
        {allowSkip && (
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition"
            data-testid="login-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-6 mt-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Zap className="w-8 h-8 text-orange-500" />
            <span className="text-2xl font-black tracking-wider text-white">SUPERCHARG'D</span>
          </div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent mb-2">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-zinc-400 text-sm">
            {mode === 'login' ? 'Sign in to access your sales arsenal' : 'Join the elite sales force'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-zinc-500"
                  placeholder="John"
                  required
                  data-testid="register-first-name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-zinc-500"
                  placeholder="Smith"
                  required
                  data-testid="register-last-name"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-zinc-500"
              placeholder="you@dealership.com"
              required
              data-testid="login-email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-zinc-500"
              placeholder="••••••••"
              required
              minLength={8}
              data-testid="login-password"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-lg font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="login-submit-btn"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Please wait...
              </>
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Toggle mode */}
        <div className="mt-5 text-center">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            className="text-sm text-zinc-400 hover:text-white transition"
            data-testid="login-toggle-mode"
          >
            {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}
          </button>
        </div>

        {/* Skip option */}
        {allowSkip && (
          <div className="mt-4 text-center">
            <button
              onClick={handleSkip}
              className="text-xs text-zinc-500 hover:text-zinc-400 transition"
              data-testid="login-skip-btn"
            >
              Skip for now (limited features)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginModal;