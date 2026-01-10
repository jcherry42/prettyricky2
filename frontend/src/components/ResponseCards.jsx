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
    <div className="space-y-4 animate-fade-in">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
        Generated Responses
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
              className="response-card p-5 cursor-pointer"
              data-testid={`response-card-${index}`}
            >
              {/* Response header */}
              <div className="flex items-center justify-between mb-3">
                <span 
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: 'hsla(40, 60%, 55%, 1)' }}
                >
                  Response {index + 1}
                </span>
                {followUpRule && (
                  <span 
                    className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full"
                    style={{
                      background: 'hsla(220, 10%, 15%, 0.8)',
                      color: 'hsla(220, 10%, 60%, 1)',
                      border: '1px solid hsla(220, 8%, 25%, 0.5)'
                    }}
                  >
                    <Clock className="w-3 h-3" />
                    {followUpRule.label}
                  </span>
                )}
              </div>
              
              {/* Response text */}
              <p className="text-[15px] text-foreground leading-relaxed mb-5">
                {response.text}
              </p>
              
              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={(e) => handleCopy(response, e)}
                  className="btn-steel flex-1 flex items-center justify-center gap-2"
                  style={isCopied ? {
                    background: 'linear-gradient(180deg, hsla(145, 50%, 35%, 0.3) 0%, hsla(145, 50%, 25%, 0.25) 100%)',
                    borderColor: 'hsla(145, 60%, 45%, 0.4)',
                    color: 'hsla(145, 70%, 60%, 1)',
                  } : {}}
                  data-testid={`copy-response-${index}`}
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
                  className="btn-luxury flex-1 flex items-center justify-center gap-2"
                  data-testid={`send-response-${index}`}
                >
                  <MessageSquare className="w-4 h-4" />
                  iMessage
                </button>
              </div>
              
              {/* Follow-up section */}
              {response.followUpText && (
                <div className="mt-5 pt-4" style={{ borderTop: '1px solid hsla(30, 15%, 18%, 0.5)' }}>
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
                      <ChevronUp className="w-4 h-4" style={{ color: 'hsla(40, 70%, 55%, 1)' }} />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </button>
                  
                  {isFollowUpExpanded && (
                    <div 
                      className="mt-3 p-4 rounded-xl animate-fade-in"
                      style={{
                        background: 'linear-gradient(135deg, hsla(35, 40%, 20%, 0.2) 0%, hsla(25, 30%, 15%, 0.15) 100%)',
                        border: '1px solid hsla(40, 40%, 30%, 0.25)'
                      }}
                    >
                      <p className="text-sm text-foreground leading-relaxed mb-3">
                        {response.followUpText}
                      </p>
                      
                      <button
                        onClick={(e) => handleCopyFollowUp(response, e)}
                        className="btn-steel w-full py-2 text-xs flex items-center justify-center gap-1.5"
                        style={isFollowUpCopied ? {
                          background: 'linear-gradient(180deg, hsla(145, 50%, 35%, 0.3) 0%, hsla(145, 50%, 25%, 0.25) 100%)',
                          borderColor: 'hsla(145, 60%, 45%, 0.4)',
                          color: 'hsla(145, 70%, 60%, 1)',
                        } : {}}
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
