import React, { useState } from 'react';
import { X, Fingerprint, KeyRound, User, Mail, Lock, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Login Modal - Luxury Car Infotainment System Design
 * Inspired by Mercedes MBUX, BMW iDrive, Audi MMI
 */
const LoginModal = ({ onClose, onSuccess, allowSkip = true }) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
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
    onClose?.();
  };

  return (
    <div className="infotainment-overlay">
      <div className="infotainment-screen">
        {/* Ambient lighting effect */}
        <div className="ambient-glow" />
        
        {/* Screen bezel */}
        <div className="screen-bezel">
          {/* Top bar - like a car's status bar */}
          <div className="infotainment-topbar">
            <div className="topbar-left">
              <div className="signal-indicator">
                <div className="signal-bar" />
                <div className="signal-bar" />
                <div className="signal-bar" />
                <div className="signal-bar active" />
              </div>
              <span className="topbar-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="topbar-center">
              <span className="system-name">SUPERCHARG&apos;D</span>
            </div>
            <div className="topbar-right">
              {/* Security badge - luxury auto style */}
              <div className="security-emblem">
                <Fingerprint className="w-3.5 h-3.5" />
                <span>SECURED</span>
              </div>
            </div>
          </div>

          {/* Main content area */}
          <div className="infotainment-content">
            {/* Close button */}
            {allowSkip && (
              <button onClick={handleSkip} className="infotainment-close" data-testid="login-close-btn">
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Header section */}
            <div className="infotainment-header">
              <div className="driver-icon">
                <User className="w-10 h-10" />
              </div>
              <h2 className="infotainment-title">
                {mode === 'login' ? 'Driver Profile' : 'New Driver Setup'}
              </h2>
              <p className="infotainment-subtitle">
                {mode === 'login' ? 'Enter credentials to unlock personalized settings' : 'Create your driver profile'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="infotainment-form">
              {mode === 'register' && (
                <div className="input-row">
                  <div className="input-group half">
                    <label>
                      <User className="w-4 h-4" />
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      required
                      data-testid="register-first-name"
                    />
                  </div>
                  <div className="input-group half">
                    <label>
                      <User className="w-4 h-4" />
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Smith"
                      required
                      data-testid="register-last-name"
                    />
                  </div>
                </div>
              )}

              <div className="input-group">
                <label>
                  <Mail className="w-4 h-4" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="driver@dealership.com"
                  required
                  data-testid="login-email"
                />
              </div>

              <div className="input-group">
                <label>
                  <Lock className="w-4 h-4" />
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  data-testid="login-password"
                />
              </div>

              {error && (
                <div className="error-display">
                  <div className="error-icon">!</div>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="submit-btn"
                data-testid="login-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-5 h-5" />
                    <span>{mode === 'login' ? 'Unlock System' : 'Create Profile'}</span>
                    <ChevronRight className="w-5 h-5 chevron" />
                  </>
                )}
              </button>
            </form>

            {/* Mode toggle */}
            <div className="mode-toggle">
              <button
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="toggle-btn"
                data-testid="login-toggle-mode"
              >
                {mode === 'login' ? 'Create New Driver Profile' : 'I Already Have a Profile'}
              </button>
            </div>

            {/* Skip option */}
            {allowSkip && (
              <div className="guest-mode">
                <button onClick={handleSkip} className="guest-btn" data-testid="login-skip-btn">
                  Continue as Guest
                </button>
              </div>
            )}
          </div>

          {/* Bottom navigation dots - like infotainment pagination */}
          <div className="infotainment-nav">
            <div className="nav-dot active" />
            <div className="nav-dot" />
            <div className="nav-dot" />
          </div>
        </div>
      </div>

      <style>{`
        /* ==========================================
           INFOTAINMENT SYSTEM OVERLAY
           Luxury Car Display Design
           ========================================== */
        
        .infotainment-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at center, rgba(15, 15, 20, 0.97) 0%, rgba(5, 5, 8, 0.99) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .infotainment-screen {
          position: relative;
          width: 100%;
          max-width: 420px;
          margin: 16px;
        }

        /* Ambient lighting - like luxury car ambient lights */
        .ambient-glow {
          position: absolute;
          inset: -40px;
          background: radial-gradient(ellipse at 50% 0%, rgba(255, 140, 0, 0.08) 0%, transparent 60%),
                      radial-gradient(ellipse at 0% 50%, rgba(255, 100, 0, 0.05) 0%, transparent 50%),
                      radial-gradient(ellipse at 100% 50%, rgba(255, 100, 0, 0.05) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

        /* Screen bezel - like a physical display frame */
        .screen-bezel {
          position: relative;
          background: linear-gradient(180deg, 
            rgba(25, 25, 30, 0.98) 0%, 
            rgba(15, 15, 18, 0.99) 100%
          );
          border-radius: 24px;
          border: 1px solid rgba(255, 140, 0, 0.15);
          box-shadow: 
            0 0 0 1px rgba(0, 0, 0, 0.8),
            0 25px 60px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            0 0 80px rgba(255, 120, 0, 0.08);
          overflow: hidden;
          z-index: 1;
        }

        /* Top status bar */
        .infotainment-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%);
          border-bottom: 1px solid rgba(255, 140, 0, 0.1);
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .signal-indicator {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 12px;
        }

        .signal-bar {
          width: 3px;
          background: rgba(255, 140, 0, 0.25);
          border-radius: 1px;
        }

        .signal-bar:nth-child(1) { height: 4px; }
        .signal-bar:nth-child(2) { height: 6px; }
        .signal-bar:nth-child(3) { height: 8px; }
        .signal-bar:nth-child(4) { height: 10px; }
        .signal-bar.active { background: #FF8C00; }

        .topbar-time {
          font-family: 'SF Pro Display', -apple-system, sans-serif;
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          letter-spacing: 0.5px;
        }

        .topbar-center {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }

        .system-name {
          font-family: 'Bebas Neue', 'Impact', sans-serif;
          font-size: 16px;
          font-weight: 400;
          letter-spacing: 0.2em;
          background: linear-gradient(180deg, #00d4ff 0%, #0099ff 50%, #00d4ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 8px rgba(0, 180, 255, 0.8));
        }

        .topbar-right {
          display: flex;
          align-items: center;
        }

        /* Security emblem - luxury auto style */
        .security-emblem {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(22, 163, 74, 0.08) 100%);
          border: 1px solid rgba(34, 197, 94, 0.25);
          border-radius: 12px;
          color: #22c55e;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .security-emblem svg {
          opacity: 0.9;
        }

        /* Main content */
        .infotainment-content {
          position: relative;
          padding: 32px 28px;
        }

        .infotainment-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .infotainment-close:hover {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.8);
        }

        /* Header */
        .infotainment-header {
          text-align: center;
          margin-bottom: 28px;
        }

        .driver-icon {
          width: 72px;
          height: 72px;
          margin: 0 auto 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(255, 140, 0, 0.15) 0%, rgba(255, 100, 0, 0.1) 100%);
          border: 2px solid rgba(255, 140, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FF8C00;
          box-shadow: 
            0 0 30px rgba(255, 140, 0, 0.15),
            inset 0 0 20px rgba(255, 140, 0, 0.05);
        }

        .infotainment-title {
          font-family: 'SF Pro Display', -apple-system, sans-serif;
          font-size: 22px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px 0;
          letter-spacing: -0.3px;
        }

        .infotainment-subtitle {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.45);
          margin: 0;
        }

        /* Form */
        .infotainment-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .input-row {
          display: flex;
          gap: 12px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-group.half {
          flex: 1;
        }

        .input-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: rgba(255, 140, 0, 0.8);
        }

        .input-group label svg {
          opacity: 0.7;
        }

        .input-group input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 140, 0, 0.15);
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-family: inherit;
          transition: all 0.2s;
        }

        .input-group input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }

        .input-group input:focus {
          outline: none;
          border-color: rgba(255, 140, 0, 0.5);
          box-shadow: 0 0 20px rgba(255, 140, 0, 0.1);
          background: rgba(0, 0, 0, 0.5);
        }

        /* Error display */
        .error-display {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 10px;
        }

        .error-icon {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #ef4444;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .error-display span {
          font-size: 13px;
          color: #fca5a5;
        }

        /* Submit button */
        .submit-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 16px;
          margin-top: 8px;
          background: linear-gradient(135deg, rgba(255, 140, 0, 0.9) 0%, rgba(255, 100, 0, 0.85) 100%);
          border: none;
          border-radius: 14px;
          color: #000;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.3px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 
            0 4px 20px rgba(255, 140, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(255, 160, 0, 1) 0%, rgba(255, 120, 0, 0.95) 100%);
          box-shadow: 
            0 6px 30px rgba(255, 140, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.25);
          transform: translateY(-1px);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        .submit-btn .chevron {
          margin-left: auto;
          opacity: 0.7;
        }

        /* Mode toggle */
        .mode-toggle {
          margin-top: 20px;
          text-align: center;
        }

        .toggle-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 13px;
          cursor: pointer;
          transition: color 0.2s;
          padding: 8px;
        }

        .toggle-btn:hover {
          color: #FF8C00;
        }

        /* Guest mode */
        .guest-mode {
          margin-top: 16px;
          text-align: center;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .guest-btn {
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.4);
          font-size: 12px;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .guest-btn:hover {
          border-color: rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.03);
        }

        /* Bottom navigation */
        .infotainment-nav {
          display: flex;
          justify-content: center;
          gap: 8px;
          padding: 16px;
          background: rgba(0, 0, 0, 0.2);
          border-top: 1px solid rgba(255, 140, 0, 0.08);
        }

        .nav-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.15);
          transition: all 0.2s;
        }

        .nav-dot.active {
          width: 24px;
          border-radius: 4px;
          background: linear-gradient(90deg, #FF8C00 0%, #FF6B00 100%);
        }
      `}</style>
    </div>
  );
};

export default LoginModal;
