import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Check, MessageSquare, Clock, ChevronDown, ChevronUp, Languages, Flame, Loader2, Pencil, X, Volume2, VolumeX } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { FOLLOW_UP_RULES } from '../data/salesData';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Check if browser supports speech synthesis
const isSpeechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

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
  const [editingId, setEditingId] = useState(null);
  const [editedTexts, setEditedTexts] = useState({});
  const [editedTranslations, setEditedTranslations] = useState({});
  const [translatingEdited, setTranslatingEdited] = useState({});
  const [speakingId, setSpeakingId] = useState(null);

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
      // Use callback to avoid re-render issues
      setTimeout(() => {
        setTranslations({});
        setShowSpanish({});
      }, 0);
    }
  }, [supercharged]);

  // Text-to-speech function
  const speakText = useCallback((responseId, text, isSpanish = false) => {
    if (!isSpeechSupported) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    // If already speaking this response, just stop
    if (speakingId === responseId) {
      setSpeakingId(null);
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isSpanish ? 'es-ES' : 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const langCode = isSpanish ? 'es' : 'en';
    const preferredVoice = voices.find(v => v.lang.startsWith(langCode) && v.localService) 
      || voices.find(v => v.lang.startsWith(langCode));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.onstart = () => setSpeakingId(responseId);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    
    window.speechSynthesis.speak(utterance);
  }, [speakingId]);

  // Get display text helper
  const getDisplayText = useCallback((response) => {
    const key = response.id;
    if (editedTexts[key] && editedTranslations[key] && showSpanish[key]) {
      return editedTranslations[key];
    }
    if (editedTexts[key]) {
      return editedTexts[key];
    }
    if (supercharged && showSpanish[key] && translations[key]) {
      return translations[key];
    }
    return response.text;
  }, [editedTexts, editedTranslations, showSpanish, supercharged, translations]);

  if (!selectedCustomer || currentResponses.length === 0) {
    return null;
  }

  const handleCopy = async (response, e) => {
    e.stopPropagation();
    const textToCopy = getDisplayText(response);
    
    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopiedId(response.id);
      setEditingId(null); // Close edit mode after copy
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSendMessage = (response, e) => {
    e.stopPropagation();
    const textToSend = getDisplayText(response);
    
    setEditingId(null); // Close edit mode after send
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

  const startEditing = (responseId, text, e) => {
    e.stopPropagation();
    setEditingId(responseId);
    if (!editedTexts[responseId]) {
      setEditedTexts(prev => ({ ...prev, [responseId]: text }));
    }
  };

  const cancelEditing = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleTextChange = (responseId, newText) => {
    setEditedTexts(prev => ({ ...prev, [responseId]: newText }));
    // Clear any existing translation when text changes
    setEditedTranslations(prev => {
      const updated = { ...prev };
      delete updated[responseId];
      return updated;
    });
  };

  const translateEditedText = async (responseId, e) => {
    e.stopPropagation();
    const textToTranslate = editedTexts[responseId];
    if (!textToTranslate) return;
    
    setTranslatingEdited(prev => ({ ...prev, [responseId]: true }));
    
    const translated = await translateText(textToTranslate);
    if (translated) {
      setEditedTranslations(prev => ({ ...prev, [responseId]: translated }));
    }
    
    setTranslatingEdited(prev => ({ ...prev, [responseId]: false }));
  };

  const speakText = useCallback((responseId, text, isSpanish = false) => {
    if (!isSpeechSupported) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    // If already speaking this response, just stop
    if (speakingId === responseId) {
      setSpeakingId(null);
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isSpanish ? 'es-ES' : 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const langCode = isSpanish ? 'es' : 'en';
    const preferredVoice = voices.find(v => v.lang.startsWith(langCode) && v.localService) 
      || voices.find(v => v.lang.startsWith(langCode));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.onstart = () => setSpeakingId(responseId);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    
    window.speechSynthesis.speak(utterance);
  }, [speakingId]);

  const getDisplayText = useCallback((response) => {
    const key = response.id;
    // If editing and has translation, check if showing Spanish
    if (editedTexts[key] && editedTranslations[key] && showSpanish[key]) {
      return editedTranslations[key];
    }
    // If edited, use edited text
    if (editedTexts[key]) {
      return editedTexts[key];
    }
    // If supercharged and showing Spanish
    if (supercharged && showSpanish[key] && translations[key]) {
      return translations[key];
    }
    return response.text;
  }, [editedTexts, editedTranslations, showSpanish, supercharged, translations]);

  const handleSpeak = (response, e) => {
    e.stopPropagation();
    const key = response.id;
    const text = getDisplayText(response);
    const isSpanish = (editedTranslations[key] && showSpanish[key]) || 
                      (supercharged && showSpanish[key] && translations[key]);
    speakText(key, text, isSpanish);
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
          
          const displayedText = getDisplayText(response);
          const isEditing = editingId === response.id;
          
          const displayedFollowUp = supercharged && showFollowUpSpanish && followUpTranslation 
            ? followUpTranslation 
            : response.followUpText;
          
          return (
            <div
              key={response.id}
              onClick={() => !isEditing && selectResponse(response)}
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
                  {supercharged && mainTranslation && !isEditing && (
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
                  {isEditing && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Editing
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {followUpRule && !isEditing && (
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
                  {isEditing ? (
                    <button
                      onClick={cancelEditing}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                      title="Cancel editing"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => startEditing(response.id, displayedText, e)}
                      className="p-1.5 rounded-lg hover:bg-amber-500/20 text-muted-foreground hover:text-amber-400 transition-colors"
                      title="Edit before sending"
                      data-testid={`edit-response-${index}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Response text - editable or display */}
              {isEditing ? (
                <div className="mb-5">
                  <textarea
                    value={editedTexts[response.id] || displayedText}
                    onChange={(e) => handleTextChange(response.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full p-3 rounded-lg text-[15px] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    style={{
                      background: 'hsla(220, 10%, 12%, 0.8)',
                      border: '1px solid hsla(40, 50%, 40%, 0.4)',
                      color: 'inherit',
                      minHeight: '120px'
                    }}
                    autoFocus
                    data-testid={`edit-textarea-${index}`}
                  />
                  {/* Translate edited text button */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={(e) => translateEditedText(response.id, e)}
                      disabled={translatingEdited[response.id] || !editedTexts[response.id]}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(180deg, hsla(25, 100%, 50%, 0.2) 0%, hsla(25, 100%, 40%, 0.15) 100%)',
                        border: '1px solid hsla(25, 100%, 50%, 0.3)',
                        color: 'hsla(30, 100%, 60%, 1)',
                      }}
                      data-testid={`translate-edited-${index}`}
                    >
                      {translatingEdited[response.id] ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Translating...
                        </>
                      ) : (
                        <>
                          <Languages className="w-3.5 h-3.5" />
                          Translate to Spanish
                        </>
                      )}
                    </button>
                    {editedTranslations[response.id] && (
                      <button
                        onClick={(e) => toggleLanguage(mainKey, e)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: showSpanish[mainKey] ? 'hsla(25, 100%, 50%, 0.25)' : 'hsla(210, 80%, 50%, 0.2)',
                          color: showSpanish[mainKey] ? 'hsla(30, 100%, 60%, 1)' : 'hsla(210, 100%, 70%, 1)',
                          border: `1px solid ${showSpanish[mainKey] ? 'hsla(25, 100%, 50%, 0.4)' : 'hsla(210, 80%, 50%, 0.3)'}`,
                        }}
                      >
                        {showSpanish[mainKey] ? '🇪🇸 Spanish' : '🇺🇸 English'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[15px] text-foreground leading-relaxed mb-5">
                  {displayedText}
                </p>
              )}
              
              {/* Action buttons */}
              <div className="flex gap-2">
                {isSpeechSupported && (
                  <button
                    onClick={(e) => handleSpeak(response, e)}
                    className="btn-steel flex items-center justify-center w-10"
                    style={speakingId === response.id ? {
                      background: 'linear-gradient(180deg, hsla(200, 70%, 45%, 0.3) 0%, hsla(200, 70%, 35%, 0.25) 100%)',
                      borderColor: 'hsla(200, 80%, 55%, 0.5)',
                      color: 'hsla(200, 90%, 65%, 1)',
                    } : {}}
                    data-testid={`speak-response-${index}`}
                    title={speakingId === response.id ? "Stop speaking" : "Read aloud"}
                  >
                    {speakingId === response.id ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                )}
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
