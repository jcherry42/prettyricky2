import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Enterprise-Grade Error Boundary
 * Catches JavaScript errors anywhere in child component tree
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log to monitoring service in production
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const { fallback, minimal } = this.props;

      if (fallback) {
        return fallback;
      }

      if (minimal) {
        return (
          <div className="error-boundary-minimal">
            <AlertTriangle className="w-5 h-5" />
            <span>Something went wrong</span>
            <button onClick={this.handleRetry} className="error-retry-btn-sm">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        );
      }

      return (
        <div className="error-boundary-container">
          <div className="error-boundary-card">
            <div className="error-icon-wrapper">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <h2 className="error-title">Something went wrong</h2>
            <p className="error-message">
              {this.props.message || "We're sorry, but something unexpected happened. Please try again."}
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details</summary>
                <pre>{this.state.error.toString()}</pre>
                {this.state.errorInfo && (
                  <pre>{this.state.errorInfo.componentStack}</pre>
                )}
              </details>
            )}

            <div className="error-actions">
              <button onClick={this.handleRetry} className="error-retry-btn">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button onClick={this.handleGoHome} className="error-home-btn">
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>
          </div>

          <style>{`
            .error-boundary-container {
              min-height: 300px;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }

            .error-boundary-card {
              max-width: 400px;
              width: 100%;
              padding: 32px;
              background: linear-gradient(180deg, rgba(25, 20, 20, 0.95) 0%, rgba(15, 12, 12, 0.98) 100%);
              border-radius: 20px;
              border: 1px solid rgba(239, 68, 68, 0.2);
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 40px rgba(239, 68, 68, 0.1);
              text-align: center;
            }

            .error-icon-wrapper {
              width: 64px;
              height: 64px;
              margin: 0 auto 20px;
              border-radius: 16px;
              background: rgba(239, 68, 68, 0.15);
              border: 1px solid rgba(239, 68, 68, 0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ef4444;
            }

            .error-title {
              font-size: 20px;
              font-weight: 700;
              color: #fff;
              margin: 0 0 8px 0;
            }

            .error-message {
              font-size: 14px;
              color: rgba(255, 255, 255, 0.6);
              line-height: 1.5;
              margin: 0 0 24px 0;
            }

            .error-details {
              margin-bottom: 24px;
              text-align: left;
              background: rgba(0, 0, 0, 0.3);
              border-radius: 8px;
              padding: 12px;
            }

            .error-details summary {
              cursor: pointer;
              font-size: 12px;
              color: rgba(239, 68, 68, 0.8);
              margin-bottom: 8px;
            }

            .error-details pre {
              font-size: 10px;
              color: rgba(255, 255, 255, 0.5);
              overflow-x: auto;
              white-space: pre-wrap;
              word-break: break-word;
            }

            .error-actions {
              display: flex;
              gap: 12px;
            }

            .error-retry-btn, .error-home-btn {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              padding: 12px 16px;
              border-radius: 12px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              border: none;
            }

            .error-retry-btn {
              background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%);
              border: 1px solid rgba(34, 197, 94, 0.4);
              color: #22c55e;
            }

            .error-retry-btn:hover {
              background: linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.2) 100%);
              box-shadow: 0 0 20px rgba(34, 197, 94, 0.2);
            }

            .error-home-btn {
              background: rgba(255, 255, 255, 0.05);
              border: 1px solid rgba(255, 255, 255, 0.1);
              color: rgba(255, 255, 255, 0.7);
            }

            .error-home-btn:hover {
              background: rgba(255, 255, 255, 0.1);
              color: #fff;
            }

            /* Minimal variant */
            .error-boundary-minimal {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 12px 16px;
              background: rgba(239, 68, 68, 0.1);
              border: 1px solid rgba(239, 68, 68, 0.2);
              border-radius: 10px;
              color: #fca5a5;
              font-size: 13px;
            }

            .error-retry-btn-sm {
              width: 28px;
              height: 28px;
              border-radius: 6px;
              background: rgba(34, 197, 94, 0.15);
              border: 1px solid rgba(34, 197, 94, 0.3);
              color: #22c55e;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-left: auto;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
export default ErrorBoundary;
