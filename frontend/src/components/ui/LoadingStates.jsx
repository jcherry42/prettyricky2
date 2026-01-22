import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Enterprise-Grade Loading States
 * Skeleton loaders, spinners, and shimmer effects
 */

// Shimmer effect keyframes
const shimmerStyle = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

/**
 * Skeleton Card - For response cards
 */
export const SkeletonCard = ({ lines = 3 }) => (
  <div className="skeleton-card">
    <div className="skeleton-header">
      <div className="skeleton-badge" />
      <div className="skeleton-tag" />
    </div>
    <div className="skeleton-content">
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i} 
          className="skeleton-line" 
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
    <div className="skeleton-actions">
      <div className="skeleton-btn" />
      <div className="skeleton-btn primary" />
    </div>
    <style>{shimmerStyle}{`
      .skeleton-card {
        padding: 20px;
        background: linear-gradient(180deg, rgba(25, 22, 18, 0.6) 0%, rgba(18, 16, 14, 0.7) 100%);
        border-radius: 16px;
        border: 1px solid rgba(255, 191, 0, 0.1);
      }
      .skeleton-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 16px;
      }
      .skeleton-badge {
        width: 80px;
        height: 16px;
        border-radius: 4px;
        background: linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }
      .skeleton-tag {
        width: 60px;
        height: 24px;
        border-radius: 12px;
        background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }
      .skeleton-content {
        margin-bottom: 16px;
      }
      .skeleton-line {
        height: 14px;
        border-radius: 4px;
        background: linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        margin-bottom: 10px;
      }
      .skeleton-actions {
        display: flex;
        gap: 10px;
      }
      .skeleton-btn {
        flex: 1;
        height: 40px;
        border-radius: 10px;
        background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }
      .skeleton-btn.primary {
        background: linear-gradient(90deg, rgba(255,191,0,0.1) 0%, rgba(255,191,0,0.2) 50%, rgba(255,191,0,0.1) 100%);
        background-size: 200% 100%;
      }
    `}</style>
  </div>
);

/**
 * Skeleton Customer Item
 */
export const SkeletonCustomerItem = () => (
  <div className="skeleton-customer">
    <div className="skeleton-avatar" />
    <div className="skeleton-customer-info">
      <div className="skeleton-name" />
      <div className="skeleton-detail" />
    </div>
    <div className="skeleton-chevron" />
    <style>{shimmerStyle}{`
      .skeleton-customer {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .skeleton-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(90deg, rgba(255,191,0,0.08) 0%, rgba(255,191,0,0.15) 50%, rgba(255,191,0,0.08) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        flex-shrink: 0;
      }
      .skeleton-customer-info {
        flex: 1;
        min-width: 0;
      }
      .skeleton-name {
        height: 16px;
        width: 140px;
        border-radius: 4px;
        background: linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        margin-bottom: 8px;
      }
      .skeleton-detail {
        height: 12px;
        width: 100px;
        border-radius: 4px;
        background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }
      .skeleton-chevron {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }
    `}</style>
  </div>
);

/**
 * Skeleton VIN Result
 */
export const SkeletonVinResult = () => (
  <div className="skeleton-vin-result">
    <div className="skeleton-vin-header">
      <div className="skeleton-vin-title" />
      <div className="skeleton-vin-subtitle" />
      <div className="skeleton-vin-badge" />
    </div>
    <div className="skeleton-vin-grid">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton-vin-spec">
          <div className="skeleton-spec-label" />
          <div className="skeleton-spec-value" />
        </div>
      ))}
    </div>
    <div className="skeleton-vin-actions">
      <div className="skeleton-vin-btn" />
      <div className="skeleton-vin-btn alt" />
    </div>
    <style>{shimmerStyle}{`
      .skeleton-vin-result {
        padding: 20px;
      }
      .skeleton-vin-header {
        text-align: center;
        margin-bottom: 20px;
      }
      .skeleton-vin-title {
        height: 28px;
        width: 180px;
        margin: 0 auto 8px;
        border-radius: 6px;
        background: linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }
      .skeleton-vin-subtitle {
        height: 20px;
        width: 140px;
        margin: 0 auto 12px;
        border-radius: 4px;
        background: linear-gradient(90deg, rgba(34,211,238,0.1) 0%, rgba(34,211,238,0.2) 50%, rgba(34,211,238,0.1) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }
      .skeleton-vin-badge {
        height: 24px;
        width: 100px;
        margin: 0 auto;
        border-radius: 12px;
        background: linear-gradient(90deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.2) 50%, rgba(34,197,94,0.1) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }
      .skeleton-vin-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 20px;
      }
      .skeleton-vin-spec {
        padding: 14px;
        background: rgba(255,255,255,0.03);
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.05);
      }
      .skeleton-spec-label {
        height: 10px;
        width: 50px;
        border-radius: 3px;
        background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        margin-bottom: 8px;
      }
      .skeleton-spec-value {
        height: 14px;
        width: 80px;
        border-radius: 4px;
        background: linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }
      .skeleton-vin-actions {
        display: flex;
        gap: 12px;
      }
      .skeleton-vin-btn {
        flex: 1;
        height: 48px;
        border-radius: 12px;
        background: linear-gradient(90deg, rgba(34,211,238,0.1) 0%, rgba(34,211,238,0.2) 50%, rgba(34,211,238,0.1) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }
      .skeleton-vin-btn.alt {
        background: linear-gradient(90deg, rgba(251,191,36,0.1) 0%, rgba(251,191,36,0.2) 50%, rgba(251,191,36,0.1) 100%);
      }
    `}</style>
  </div>
);

/**
 * Full-Screen Loading
 */
export const FullScreenLoader = ({ message = 'Loading...' }) => (
  <div className="fullscreen-loader">
    <div className="loader-content">
      <div className="loader-spinner">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
      <p className="loader-message">{message}</p>
      <div className="loader-dots">
        <span className="dot" style={{ animationDelay: '0s' }} />
        <span className="dot" style={{ animationDelay: '0.2s' }} />
        <span className="dot" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
    <style>{`
      .fullscreen-loader {
        position: fixed;
        inset: 0;
        background: rgba(10, 8, 6, 0.95);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      }
      .loader-content {
        text-align: center;
      }
      .loader-spinner {
        color: #FFBF00;
        margin-bottom: 16px;
        filter: drop-shadow(0 0 10px rgba(255, 191, 0, 0.4));
      }
      .loader-message {
        color: rgba(255, 255, 255, 0.7);
        font-size: 14px;
        margin: 0 0 12px 0;
      }
      .loader-dots {
        display: flex;
        justify-content: center;
        gap: 6px;
      }
      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #FFBF00;
        animation: dotPulse 1s ease-in-out infinite;
      }
      @keyframes dotPulse {
        0%, 100% { opacity: 0.3; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1); }
      }
    `}</style>
  </div>
);

/**
 * Inline Spinner
 */
export const InlineSpinner = ({ size = 'md', color = 'primary' }) => {
  const sizes = { sm: 14, md: 18, lg: 24 };
  const colors = {
    primary: '#FFBF00',
    cyan: '#22d3ee',
    white: '#fff',
    muted: 'rgba(255,255,255,0.5)'
  };
  
  return (
    <Loader2 
      className="animate-spin" 
      style={{ 
        width: sizes[size], 
        height: sizes[size], 
        color: colors[color] 
      }} 
    />
  );
};

/**
 * Progress Bar
 */
export const ProgressBar = ({ progress = 0, color = 'primary', label }) => (
  <div className="progress-container">
    {label && <span className="progress-label">{label}</span>}
    <div className="progress-track">
      <div 
        className={`progress-fill ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
    <style>{`
      .progress-container {
        width: 100%;
      }
      .progress-label {
        display: block;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        margin-bottom: 6px;
      }
      .progress-track {
        height: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.3s ease;
      }
      .progress-fill.primary {
        background: linear-gradient(90deg, #FFBF00 0%, #FF8C00 100%);
      }
      .progress-fill.cyan {
        background: linear-gradient(90deg, #22d3ee 0%, #0891b2 100%);
      }
      .progress-fill.green {
        background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
      }
    `}</style>
  </div>
);

export default {
  SkeletonCard,
  SkeletonCustomerItem,
  SkeletonVinResult,
  FullScreenLoader,
  InlineSpinner,
  ProgressBar
};
