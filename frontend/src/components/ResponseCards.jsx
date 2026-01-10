import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Check, MessageSquare, Clock, ChevronDown, ChevronUp, Languages, Flame, Loader2 } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { FOLLOW_UP_RULES } from '../data/salesData';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Translation helper
const translateText = async (text) => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source_lang: 'en', target_lang: 'es' }),
    });
    if (!res.ok) throw new Error('Translation failed');
    const data = await res.json();
    return data.translated_text;
  } catch (err) {
    console.error('Translation error:', err);
    return null;
  }
};

export const ResponseCards = () => {
  const { 
    currentResponses, 
    selectedResponse, 
    selectResponse,
    selectedCustomer,
    copyToClipboard,
    shareToMessages,
    supercharged,
  } = useSales();
  
  const [copiedId, setCopiedId] = useState(null);
  const [expandedFollowUp, setExpandedFollowUp] = useState(null);
  const [translations, setTranslations] = useState({});
  const [translating, setTranslating] = useState({});
  const [showSpanish, setShowSpanish] = useState({});

  // Translate responses when supercharged mode is active
  const translateResponse = useCallback(async (responseId, text, isFollowUp = false) => {
    const key = isFollowUp ? `${responseId}-followup` : responseId;
    
    if (translations[key]) {
      return; // Already translated
    }
    
    setTranslating(prev => ({ ...prev, [key]: true }));
    
    const translated = await translateText(text);
    if (translated) {
      setTranslations(prev => ({ ...prev, [key]: translated }));
    }
    
    setTranslating(prev => ({ ...prev, [key]: false }));
  }, [translations]);

  // Auto-translate when supercharged and responses change
  useEffect(() => {
    if (supercharged && currentResponses.length > 0) {
      currentResponses.forEach(response => {
        translateResponse(response.id, response.text);
        if (response.followUpText) {
          translateResponse(response.id, response.followUpText, true);
        }
      });
    }
  }, [supercharged, currentResponses, translateResponse]);

  // Reset translations when supercharged mode is turned off
  useEffect(() => {
    if (!supercharged) {
      setTranslations({});
      setShowSpanish({});
    }
  }, [supercharged]);

  if (!selectedCustomer || currentResponses.length === 0) {
    return null;
  }

  const handleCopy = async (response, e) => {
    e.stopPropagation();
    const key = response.id;
    const textToCopy = supercharged && showSpanish[key] && translations[key] 
      ? translations[key] 
      : response.text;
    
    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopiedId(response.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSendMessage = (response, e) => {
    e.stopPropagation();
    const key = response.id;
    const textToSend = supercharged && showSpanish[key] && translations[key] 
      ? translations[key] 
      : response.text;
    
    shareToMessages(textToSend);
  };

  const handleCopyFollowUp = async (response, e) => {
    e.stopPropagation();
    const key = `${response.id}-followup`;
    const textToCopy = supercharged && showSpanish[key] && translations[key] 
      ? translations[key] 
      : response.followUpText;
    
    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const toggleLanguage = (key, e) => {
    e.stopPropagation();
    setShowSpanish(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Generated Responses
        </h2>
        {supercharged && (
          <span className="supercharged-badge">
            <Flame className="w-3 h-3" />
            Bilingual
          </span>
        )}
      </div>
      
      <div className="space-y-3">
        {currentResponses.map((response, index) => {
          const isSelected = selectedResponse?.id === response.id;
          const isCopied = copiedId === response.id;
          const isFollowUpCopied = copiedId === `${response.id}-followup`;
          const isFollowUpExpanded = expandedFollowUp === response.id;
          const followUpRule = FOLLOW_UP_RULES.find(r => r.id === response.followUp);
          
          const mainKey = response.id;
          const followUpKey = `${response.id}-followup`;
          const isMainTranslating = translating[mainKey];
          const isFollowUpTranslating = translating[followUpKey];
          const mainTranslation = translations[mainKey];
          const followUpTranslation = translations[followUpKey];
          const showMainSpanish = showSpanish[mainKey];
          const showFollowUpSpanish = showSpanish[followUpKey];
          
          const displayedText = supercharged && showMainSpanish && mainTranslation 
            ? mainTranslation 
            : response.text;
          
          const displayedFollowUp = supercharged && showFollowUpSpanish && followUpTranslation 
            ? followUpTranslation 
            : response.followUpText;
          
          return (
            <div
              key={response.id}
              onClick={() => selectResponse(response)}
              className="response-card p-5 cursor-pointer"
              data-testid={`response-card-${index}`}
            >
              {/* Response header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span 
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: 'hsla(40, 60%, 55%, 1)' }}
                  >
                    Response {index + 1}
                  </span>
                  {supercharged && mainTranslation && (
                    <button
                      onClick={(e) => toggleLanguage(mainKey, e)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all"
                      style={{
                        background: showMainSpanish ? 'hsla(25, 100%, 50%, 0.2)' : 'hsla(210, 80%, 50%, 0.15)',
                        color: showMainSpanish ? 'hsla(30, 100%, 60%, 1)' : 'hsla(210, 100%, 70%, 1)',
                        border: `1px solid ${showMainSpanish ? 'hsla(25, 100%, 50%, 0.3)' : 'hsla(210, 80%, 50%, 0.25)'}`,
                      }}
                      data-testid={`toggle-lang-${index}`}
                    >
                      <Languages className="w-3 h-3" />
                      {showMainSpanish ? 'ES' : 'EN'}
                    </button>
                  )}
                  {supercharged && isMainTranslating && (
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'hsla(30, 100%, 55%, 1)' }} />
                  )}
                </div>
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
                {displayedText}
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                        Follow-up ({followUpRule?.label})
                      </span>
                      {supercharged && isFollowUpTranslating && (
                        <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'hsla(30, 100%, 55%, 1)' }} />
                      )}
                    </div>
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
                      {/* Language toggle for follow-up */}
                      {supercharged && followUpTranslation && (
                        <div className="flex justify-end mb-2">
                          <button
                            onClick={(e) => toggleLanguage(followUpKey, e)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all"
                            style={{
                              background: showFollowUpSpanish ? 'hsla(25, 100%, 50%, 0.2)' : 'hsla(210, 80%, 50%, 0.15)',
                              color: showFollowUpSpanish ? 'hsla(30, 100%, 60%, 1)' : 'hsla(210, 100%, 70%, 1)',
                              border: `1px solid ${showFollowUpSpanish ? 'hsla(25, 100%, 50%, 0.3)' : 'hsla(210, 80%, 50%, 0.25)'}`,
                            }}
                          >
                            <Languages className="w-3 h-3" />
                            {showFollowUpSpanish ? 'ES' : 'EN'}
                          </button>
                        </div>
                      )}
                      
                      <p className="text-sm text-foreground leading-relaxed mb-3">
                        {displayedFollowUp}
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
