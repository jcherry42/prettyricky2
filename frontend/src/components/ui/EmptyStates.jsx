import React from 'react';
import { 
  Users, Car, FileText, MessageSquare, Search, 
  Inbox, Sparkles, Scan, Wifi, WifiOff, AlertCircle
} from 'lucide-react';

/**
 * Enterprise-Grade Empty States
 * Beautiful illustrations and helpful guidance
 */

const EmptyStateWrapper = ({ children, className = '' }) => (
  <div className={`empty-state-wrapper ${className}`}>
    {children}
    <style>{`
      .empty-state-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
      }
      .empty-icon-container {
        width: 80px;
        height: 80px;
        border-radius: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
        position: relative;
      }
      .empty-icon-container::before {
        content: '';
        position: absolute;
        inset: -4px;
        border-radius: 28px;
        background: inherit;
        opacity: 0.3;
        filter: blur(12px);
      }
      .empty-icon-container.amber {
        background: linear-gradient(135deg, rgba(255, 191, 0, 0.2) 0%, rgba(255, 140, 0, 0.15) 100%);
        border: 1px solid rgba(255, 191, 0, 0.3);
        color: #FFBF00;
      }
      .empty-icon-container.cyan {
        background: linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%);
        border: 1px solid rgba(34, 211, 238, 0.3);
        color: #22d3ee;
      }
      .empty-icon-container.purple {
        background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.15) 100%);
        border: 1px solid rgba(168, 85, 247, 0.3);
        color: #a855f7;
      }
      .empty-icon-container.red {
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.15) 100%);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #ef4444;
      }
      .empty-icon-container.gray {
        background: linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(107, 114, 128, 0.1) 100%);
        border: 1px solid rgba(156, 163, 175, 0.2);
        color: #9ca3af;
      }
      .empty-title {
        font-size: 18px;
        font-weight: 700;
        color: #fff;
        margin: 0 0 8px 0;
      }
      .empty-description {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.5);
        line-height: 1.5;
        max-width: 280px;
        margin: 0 0 20px 0;
      }
      .empty-action {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }
      .empty-action.primary {
        background: linear-gradient(135deg, rgba(255, 191, 0, 0.2) 0%, rgba(255, 140, 0, 0.15) 100%);
        border: 1px solid rgba(255, 191, 0, 0.4);
        color: #FFBF00;
      }
      .empty-action.primary:hover {
        background: linear-gradient(135deg, rgba(255, 191, 0, 0.3) 0%, rgba(255, 140, 0, 0.25) 100%);
        box-shadow: 0 0 20px rgba(255, 191, 0, 0.2);
      }
      .empty-action.secondary {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.7);
      }
      .empty-hint {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.3);
        margin-top: 16px;
      }
    `}</style>
  </div>
);

/**
 * No Customers Empty State
 */
export const NoCustomers = ({ onAction }) => (
  <EmptyStateWrapper>
    <div className="empty-icon-container amber">
      <Users className="w-8 h-8" />
    </div>
    <h3 className="empty-title">No Customers Yet</h3>
    <p className="empty-description">
      Start by adding your first customer or importing from your CRM.
    </p>
    {onAction && (
      <button className="empty-action primary" onClick={onAction}>
        <Users className="w-4 h-4" />
        Add Customer
      </button>
    )}
    <p className="empty-hint">Tip: Use Quick Add button for walk-ins</p>
  </EmptyStateWrapper>
);

/**
 * No Vehicles Empty State
 */
export const NoVehicles = ({ onAction }) => (
  <EmptyStateWrapper>
    <div className="empty-icon-container cyan">
      <Car className="w-8 h-8" />
    </div>
    <h3 className="empty-title">No Vehicles in Inventory</h3>
    <p className="empty-description">
      Scan VINs or import your inventory to get started.
    </p>
    {onAction && (
      <button className="empty-action primary" onClick={onAction}>
        <Scan className="w-4 h-4" />
        Scan VIN
      </button>
    )}
  </EmptyStateWrapper>
);

/**
 * No Search Results
 */
export const NoSearchResults = ({ query, onClear }) => (
  <EmptyStateWrapper>
    <div className="empty-icon-container gray">
      <Search className="w-8 h-8" />
    </div>
    <h3 className="empty-title">No Results Found</h3>
    <p className="empty-description">
      No matches for &ldquo;{query}&rdquo;. Try a different search term.
    </p>
    {onClear && (
      <button className="empty-action secondary" onClick={onClear}>
        Clear Search
      </button>
    )}
  </EmptyStateWrapper>
);

/**
 * No Responses Generated
 */
export const NoResponses = ({ onAction }) => (
  <EmptyStateWrapper>
    <div className="empty-icon-container purple">
      <MessageSquare className="w-8 h-8" />
    </div>
    <h3 className="empty-title">No Responses Yet</h3>
    <p className="empty-description">
      Select a customer, inquiry type, and tone to generate personalized responses.
    </p>
    {onAction && (
      <button className="empty-action primary" onClick={onAction}>
        <Sparkles className="w-4 h-4" />
        Generate Response
      </button>
    )}
  </EmptyStateWrapper>
);

/**
 * Offline State
 */
export const OfflineState = ({ onRetry }) => (
  <EmptyStateWrapper>
    <div className="empty-icon-container red">
      <WifiOff className="w-8 h-8" />
    </div>
    <h3 className="empty-title">You're Offline</h3>
    <p className="empty-description">
      Check your internet connection and try again.
    </p>
    {onRetry && (
      <button className="empty-action primary" onClick={onRetry}>
        <Wifi className="w-4 h-4" />
        Retry Connection
      </button>
    )}
  </EmptyStateWrapper>
);

/**
 * Error State
 */
export const ErrorState = ({ message, onRetry }) => (
  <EmptyStateWrapper>
    <div className="empty-icon-container red">
      <AlertCircle className="w-8 h-8" />
    </div>
    <h3 className="empty-title">Something Went Wrong</h3>
    <p className="empty-description">
      {message || "We couldn't load this content. Please try again."}
    </p>
    {onRetry && (
      <button className="empty-action primary" onClick={onRetry}>
        Retry
      </button>
    )}
  </EmptyStateWrapper>
);

/**
 * No Recent Scans
 */
export const NoRecentScans = () => (
  <EmptyStateWrapper className="compact">
    <div className="empty-icon-container cyan" style={{ width: 56, height: 56 }}>
      <Scan className="w-6 h-6" />
    </div>
    <h3 className="empty-title" style={{ fontSize: 14 }}>No Recent Scans</h3>
    <p className="empty-description" style={{ fontSize: 12, marginBottom: 0 }}>
      Scanned VINs will appear here for quick access.
    </p>
  </EmptyStateWrapper>
);

/**
 * Inbox Empty
 */
export const InboxEmpty = () => (
  <EmptyStateWrapper>
    <div className="empty-icon-container amber">
      <Inbox className="w-8 h-8" />
    </div>
    <h3 className="empty-title">Inbox Empty</h3>
    <p className="empty-description">
      No new notifications or messages at this time.
    </p>
  </EmptyStateWrapper>
);

export default {
  NoCustomers,
  NoVehicles,
  NoSearchResults,
  NoResponses,
  OfflineState,
  ErrorState,
  NoRecentScans,
  InboxEmpty
};
