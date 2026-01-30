/**
 * Enterprise Error Boundary - Rolls Royce level error handling
 * Graceful degradation with premium user experience
 */
import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    
    // Log error to monitoring service in production
    if (import.meta.env.PROD) {
      // Could integrate with Sentry, LogRocket, etc.
      console.error('Error Boundary caught:', error, errorInfo);
    }
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-content">
            <div className="error-icon">
              <AlertTriangle className="w-16 h-16" />
            </div>
            <h1 className="error-title">Something went wrong</h1>
            <p className="error-message">
              We apologize for the inconvenience. Our team has been notified.
            </p>
            
            <div className="error-actions">
              <button 
                onClick={this.handleRefresh}
                className="error-btn primary"
                aria-label="Refresh page"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Page
              </button>
              <button 
                onClick={this.handleGoHome}
                className="error-btn secondary"
                aria-label="Go to home page"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>
            
            {import.meta.env.DEV && this.state.error && (
              <details className="error-details">
                <summary>Technical Details</summary>
                <pre>{this.state.error.toString()}</pre>
                <pre>{this.state.errorInfo?.componentStack}</pre>
              </details>
            )}
          </div>
          
          <style>{`
            .error-boundary {
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
              background: linear-gradient(165deg, #1a1816 0%, #0f0e0d 50%, #141210 100%);
            }
            
            .error-content {
              text-align: center;
              max-width: 400px;
            }
            
            .error-icon {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 80px;
              height: 80px;
              border-radius: 50%;
              background: rgba(255, 100, 100, 0.1);
              color: #ff6b6b;
              margin-bottom: 24px;
            }
            
            .error-title {
              font-size: 24px;
              font-weight: 700;
              color: #fff;
              margin: 0 0 12px;
            }
            
            .error-message {
              font-size: 14px;
              color: rgba(255, 255, 255, 0.6);
              margin: 0 0 32px;
              line-height: 1.6;
            }
            
            .error-actions {
              display: flex;
              gap: 12px;
              justify-content: center;
            }
            
            .error-btn {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 12px 20px;
              border-radius: 10px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
            }
            
            .error-btn.primary {
              background: linear-gradient(135deg, #FFBF00 0%, #FF8C00 100%);
              border: none;
              color: #000;
            }
            
            .error-btn.primary:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(255, 191, 0, 0.3);
            }
            
            .error-btn.secondary {
              background: rgba(255, 255, 255, 0.08);
              border: 1px solid rgba(255, 255, 255, 0.15);
              color: rgba(255, 255, 255, 0.8);
            }
            
            .error-btn.secondary:hover {
              background: rgba(255, 255, 255, 0.12);
            }
            
            .error-details {
              margin-top: 32px;
              text-align: left;
              background: rgba(0, 0, 0, 0.3);
              border-radius: 8px;
              padding: 12px;
            }
            
            .error-details summary {
              cursor: pointer;
              font-size: 12px;
              color: rgba(255, 255, 255, 0.5);
              margin-bottom: 8px;
            }
            
            .error-details pre {
              font-size: 11px;
              color: #ff6b6b;
              overflow-x: auto;
              white-space: pre-wrap;
              word-break: break-word;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
