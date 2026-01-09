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
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground px-1">
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
              {/* Response number */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Response {index + 1}
                </span>
                {followUpRule && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {followUpRule.label}
                  </span>
                )}
              </div>
              
              {/* Response text */}
              <p className="text-sm text-foreground leading-relaxed mb-4">
                {response.text}
              </p>
              
              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={(e) => handleCopy(response, e)}
                  className={`
                    ios-btn flex-1 text-sm gap-2
                    ${isCopied 
                      ? 'bg-success text-success-foreground' 
                      : 'bg-secondary text-secondary-foreground'
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
                <div className="mt-3 pt-3 border-t border-border">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedFollowUp(isFollowUpExpanded ? null : response.id);
                    }}
                    className="flex items-center justify-between w-full text-left py-1"
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      Follow-up ({followUpRule?.label})
                    </span>
                    {isFollowUpExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  
                  {isFollowUpExpanded && (
                    <div className="mt-2 p-3 bg-muted/50 rounded-lg animate-fade-in">
                      <p className="text-sm text-foreground leading-relaxed mb-3">
                        {response.followUpText}
                      </p>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => handleCopyFollowUp(response, e)}
                          className={`
                            ios-btn flex-1 text-xs gap-1.5
                            ${isFollowUpCopied 
                              ? 'bg-success text-success-foreground' 
                              : 'bg-card text-foreground border border-border'
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
