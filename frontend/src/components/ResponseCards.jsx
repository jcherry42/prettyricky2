import React, { useState } from 'react';
import { Copy, Check, MessageSquare, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { FOLLOW_UP_RULES } from '../data/salesData';

export const ResponseCards = () => {
  const { 
    currentResponses, 
    selectedResponse, 
    selectResponse,
    selectedCustomer,
    copyToClipboard,
    shareToMessages,
  } = useSales();
  
  const [copiedId, setCopiedId] = useState(null);
  const [expandedFollowUp, setExpandedFollowUp] = useState(null);

  if (!selectedCustomer || currentResponses.length === 0) {
    return null;
  }

  const handleCopy = async (response, e) => {
    e.stopPropagation();
    const success = await copyToClipboard(response.text);
    if (success) {
      setCopiedId(response.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSendMessage = (response, e) => {
    e.stopPropagation();
    shareToMessages(response.text);
  };

  const handleCopyFollowUp = async (response, e) => {
    e.stopPropagation();
    const success = await copyToClipboard(response.followUpText);
    if (success) {
      setCopiedId(`${response.id}-followup`);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="space-y-3 animate-fade-in">
      <h2 className="text-sm font-semibold text-muted-foreground px-1">
        Your responses
      </h2>
      
      <div className="space-y-3">
        {currentResponses.map((response, index) => {
          const isSelected = selectedResponse?.id === response.id;
          const isCopied = copiedId === response.id;
          const isFollowUpCopied = copiedId === `${response.id}-followup`;
          const isFollowUpExpanded = expandedFollowUp === response.id;
          const followUpRule = FOLLOW_UP_RULES.find(r => r.id === response.followUp);
          
          return (
            <div
              key={response.id}
              onClick={() => selectResponse(response)}
              className={`response-card ${isSelected ? 'selected' : ''}`}
            >
              {/* Response header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-primary uppercase tracking-wide">
                  Response {index + 1}
                </span>
                {followUpRule && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                    <Clock className="w-3 h-3" />
                    {followUpRule.label}
                  </span>
                )}
              </div>
              
              {/* Response text */}
              <p className="text-[15px] text-foreground leading-relaxed mb-4">
                {response.text}
              </p>
              
              {/* Action buttons */}
              <div className="flex gap-2.5">
                <button
                  onClick={(e) => handleCopy(response, e)}
                  className={`
                    ios-btn flex-1 text-sm gap-2 font-semibold
                    ${isCopied 
                      ? 'ios-btn-success' 
                      : 'ios-btn-secondary'
                    }
                  `}
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
                
                <button
                  onClick={(e) => handleSendMessage(response, e)}
                  className="ios-btn-primary flex-1 text-sm gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  iMessage
                </button>
              </div>
              
              {/* Follow-up section */}
              {response.followUpText && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedFollowUp(isFollowUpExpanded ? null : response.id);
                    }}
                    className="flex items-center justify-between w-full text-left py-1 group"
                  >
                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                      Follow-up ({followUpRule?.label})
                    </span>
                    {isFollowUpExpanded ? (
                      <ChevronUp className="w-4 h-4 text-primary" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </button>
                  
                  {isFollowUpExpanded && (
                    <div className="mt-3 p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20 animate-fade-in">
                      <p className="text-sm text-foreground leading-relaxed mb-3">
                        {response.followUpText}
                      </p>
                      
                      <button
                        onClick={(e) => handleCopyFollowUp(response, e)}
                        className={`
                          ios-btn w-full text-xs gap-1.5 font-semibold
                          ${isFollowUpCopied 
                            ? 'ios-btn-success' 
                            : 'ios-btn-secondary'
                          }
                        `}
                      >
                        {isFollowUpCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Follow-up
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResponseCards;
