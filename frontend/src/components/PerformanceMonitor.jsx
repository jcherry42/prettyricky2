import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Trash2, AlertTriangle, CheckCircle, Cpu, HardDrive, Clock, Zap } from 'lucide-react';
import performanceManager, { getMetrics, deepCleanup, routineCleanup } from '../utils/performanceManager';

/**
 * Performance Monitor Component
 * Shows real-time performance metrics and provides manual cleanup controls
 * Only visible in development mode or when explicitly enabled
 */
export const PerformanceMonitor = ({ 
  visible = false, 
  position = 'bottom-left',
  compact = true 
}) => {
  const [metrics, setMetrics] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [lastCleanResult, setLastCleanResult] = useState(null);
  
  // Update metrics every 5 seconds
  useEffect(() => {
    if (!visible) return;
    
    const update = () => setMetrics(getMetrics());
    update();
    
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [visible]);
  
  const handleCleanup = useCallback(async (deep = false) => {
    setCleaning(true);
    try {
      const result = deep ? await deepCleanup() : await routineCleanup();
      setLastCleanResult({ success: true, deep, result });
      setMetrics(getMetrics());
    } catch (e) {
      setLastCleanResult({ success: false, error: e.message });
    } finally {
      setCleaning(false);
    }
  }, []);
  
  if (!visible || !metrics) return null;
  
  const memoryStatus = metrics.memory.available
    ? metrics.memory.used > 200 ? 'critical' 
    : metrics.memory.used > 100 ? 'warning' 
    : 'healthy'
    : 'unknown';
  
  const formatUptime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };
  
  const positionStyles = {
    'bottom-left': { bottom: 16, left: 16 },
    'bottom-right': { bottom: 16, right: 16 },
    'top-left': { top: 80, left: 16 },
    'top-right': { top: 80, right: 16 },
  };

  if (compact && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="perf-monitor-fab"
        style={positionStyles[position]}
        title="Performance Monitor"
      >
        <Activity className={`w-5 h-5 ${memoryStatus === 'critical' ? 'text-red-500' : memoryStatus === 'warning' ? 'text-amber-500' : 'text-green-500'}`} />
        <style>{`
          .perf-monitor-fab {
            position: fixed;
            z-index: 9998;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }
          .perf-monitor-fab:hover {
            transform: scale(1.1);
            border-color: rgba(255, 255, 255, 0.2);
          }
        `}</style>
      </button>
    );
  }

  return (
    <div className="perf-monitor" style={positionStyles[position]}>
      {/* Header */}
      <div className="perf-header">
        <div className="perf-title">
          <Cpu className="w-4 h-4" />
          <span>Performance Monitor</span>
        </div>
        <button onClick={() => setIsExpanded(false)} className="perf-close">×</button>
      </div>
      
      {/* Status */}
      <div className="perf-status">
        <div className={`status-indicator ${memoryStatus}`}>
          {memoryStatus === 'healthy' ? <CheckCircle className="w-4 h-4" /> : 
           memoryStatus === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
           memoryStatus === 'critical' ? <AlertTriangle className="w-4 h-4" /> :
           <Activity className="w-4 h-4" />}
          <span>{memoryStatus === 'unknown' ? 'Monitoring' : memoryStatus.toUpperCase()}</span>
        </div>
      </div>
      
      {/* Metrics */}
      <div className="perf-metrics">
        {metrics.memory.available && (
          <div className="metric">
            <HardDrive className="w-3.5 h-3.5" />
            <span className="metric-label">Memory</span>
            <span className="metric-value">{metrics.memory.used}MB</span>
          </div>
        )}
        
        <div className="metric">
          <Clock className="w-3.5 h-3.5" />
          <span className="metric-label">Uptime</span>
          <span className="metric-value">{formatUptime(metrics.uptime)}</span>
        </div>
        
        <div className="metric">
          <Zap className="w-3.5 h-3.5" />
          <span className="metric-label">Cleanups</span>
          <span className="metric-value">{metrics.cleanupCount}</span>
        </div>
        
        {metrics.memoryPeakMB > 0 && (
          <div className="metric">
            <Activity className="w-3.5 h-3.5" />
            <span className="metric-label">Peak</span>
            <span className="metric-value">{metrics.memoryPeakMB}MB</span>
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="perf-actions">
        <button 
          onClick={() => handleCleanup(false)} 
          disabled={cleaning}
          className="perf-btn"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Quick Clean
        </button>
        <button 
          onClick={() => handleCleanup(true)} 
          disabled={cleaning}
          className="perf-btn deep"
        >
          <Zap className="w-3.5 h-3.5" />
          Deep Clean
        </button>
      </div>
      
      {/* Last result */}
      {lastCleanResult && (
        <div className={`perf-result ${lastCleanResult.success ? 'success' : 'error'}`}>
          {lastCleanResult.success 
            ? `${lastCleanResult.deep ? 'Deep' : 'Quick'} cleanup complete`
            : `Error: ${lastCleanResult.error}`}
        </div>
      )}

      <style>{`
        .perf-monitor {
          position: fixed;
          z-index: 9998;
          width: 260px;
          background: linear-gradient(180deg, rgba(20, 20, 25, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          font-size: 12px;
          overflow: hidden;
          backdrop-filter: blur(12px);
        }
        
        .perf-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }
        
        .perf-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #fff;
          font-weight: 600;
        }
        
        .perf-close {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
        }
        
        .perf-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        
        .perf-status {
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .status-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .status-indicator.healthy {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }
        
        .status-indicator.warning {
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #f59e0b;
        }
        
        .status-indicator.critical {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }
        
        .status-indicator.unknown {
          background: rgba(156, 163, 175, 0.15);
          border: 1px solid rgba(156, 163, 175, 0.3);
          color: #9ca3af;
        }
        
        .perf-metrics {
          padding: 12px 14px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        
        .metric {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .metric svg {
          color: rgba(255, 255, 255, 0.4);
        }
        
        .metric-label {
          color: rgba(255, 255, 255, 0.5);
          font-size: 10px;
        }
        
        .metric-value {
          margin-left: auto;
          color: #fff;
          font-weight: 600;
          font-family: 'SF Mono', monospace;
        }
        
        .perf-actions {
          padding: 12px 14px;
          display: flex;
          gap: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .perf-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .perf-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        
        .perf-btn:disabled {
          opacity: 0.5;
          cursor: wait;
        }
        
        .perf-btn.deep {
          background: rgba(139, 92, 246, 0.15);
          border-color: rgba(139, 92, 246, 0.3);
          color: #a78bfa;
        }
        
        .perf-btn.deep:hover:not(:disabled) {
          background: rgba(139, 92, 246, 0.25);
        }
        
        .perf-result {
          padding: 8px 14px;
          font-size: 10px;
          text-align: center;
        }
        
        .perf-result.success {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
        }
        
        .perf-result.error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
      `}</style>
    </div>
  );
};

export default PerformanceMonitor;
