import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, Loader2, Volume2, X, Globe, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Language config
const LANG_CONFIG = {
  en: { name: 'English', flag: '🇺🇸', speech: 'en-US' },
  es: { name: 'Spanish', flag: '🇪🇸', speech: 'es-ES' },
  fr: { name: 'French', flag: '🇫🇷', speech: 'fr-FR' },
  ja: { name: 'Japanese', flag: '🇯🇵', speech: 'ja-JP' },
  ko: { name: 'Korean', flag: '🇰🇷', speech: 'ko-KR' },
};

/**
 * Push-to-Talk Voice Translator
 * Transparent glass design matching Quick Add button
 * Fixed speech recognition for iOS/Safari
 */
export const VoiceTranslator = () => {
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const isActiveRef = useRef(false);
  const timeoutRef = useRef(null);

  // Get target language from localStorage
  const targetLang = localStorage.getItem('defaultTargetLanguage') || 'es';
  const sourceLang = targetLang === 'en' ? 'es' : 'en';
  
  const sourceConfig = LANG_CONFIG[sourceLang] || LANG_CONFIG.en;
  const targetConfig = LANG_CONFIG[targetLang] || LANG_CONFIG.es;

  // Check speech recognition support
  const getSpeechRecognition = () => {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Stop listening helper
  const stopListening = useCallback(() => {
    isActiveRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('[PTT] Stop error (ignored):', e.message);
      }
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Translate the captured text
  const doTranslate = useCallback(async (text) => {
    if (!text.trim()) {
      setError('No speech detected. Tap and speak clearly.');
      setShowResult(true);
      return;
    }
    
    setIsTranslating(true);
    setError('');
    setDebugInfo(`Translating: "${text.substring(0, 30)}..."`);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          source_lang: sourceLang,
          target_lang: targetLang
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Translation failed');
      }
      
      const data = await res.json();
      setTranslation(data.translated_text || '');
      setShowResult(true);
      setDebugInfo('Translation complete');
    } catch (err) {
      console.error('[PTT] Translation error:', err);
      setError(`Translation failed: ${err.message}`);
      setShowResult(true);
    } finally {
      setIsTranslating(false);
    }
  }, [sourceLang, targetLang]);

  // Start listening
  const startListening = useCallback(async () => {
    const SpeechRecognition = getSpeechRecognition();
    
    if (!SpeechRecognition) {
      setError('Speech recognition not supported. Use Chrome or Safari.');
      setShowResult(true);
      return;
    }

    // Reset state
    setTranscript('');
    setTranslation('');
    setError('');
    setShowResult(false);
    finalTranscriptRef.current = '';
    setDebugInfo('Requesting microphone...');

    // Request microphone permission first (iOS requires this)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Keep stream active briefly to ensure permission is granted
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
      }, 100);
      setDebugInfo('Microphone access granted');
    } catch (e) {
      console.error('[PTT] Microphone error:', e);
      setError('Microphone access denied. Please allow microphone access in Settings.');
      setShowResult(true);
      return;
    }

    // Create new recognition instance
    const recognition = new SpeechRecognition();
    recognition.lang = sourceConfig.speech;
    recognition.continuous = false; // iOS works better with continuous=false
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[PTT] Recognition started');
      setDebugInfo(`Listening in ${sourceConfig.name}...`);
      isActiveRef.current = true;
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      
      if (final) {
        finalTranscriptRef.current += ' ' + final;
        setDebugInfo(`Final: "${final}"`);
      }
      
      const displayText = (finalTranscriptRef.current + ' ' + interim).trim();
      setTranscript(displayText);
      console.log('[PTT] Result:', { final, interim, display: displayText });
    };

    recognition.onerror = (event) => {
      console.error('[PTT] Recognition error:', event.error);
      setDebugInfo(`Error: ${event.error}`);
      
      if (event.error === 'no-speech') {
        // Don't show error for no-speech, just let them try again
        setError('No speech heard. Tap to try again.');
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone access denied. Enable in Settings > Safari > Microphone.');
      } else if (event.error === 'network') {
        setError('Network error. Check your internet connection.');
      } else if (event.error !== 'aborted') {
        setError(`Recognition error: ${event.error}`);
      }
      
      stopListening();
      if (event.error !== 'aborted') {
        setShowResult(true);
      }
    };

    recognition.onend = () => {
      console.log('[PTT] Recognition ended, transcript:', finalTranscriptRef.current);
      setDebugInfo('Recognition ended');
      
      // If we have captured speech, translate it
      const captured = finalTranscriptRef.current.trim();
      if (captured && isActiveRef.current) {
        doTranslate(captured);
      }
      
      stopListening();
    };

    // Store reference and start
    recognitionRef.current = recognition;
    
    try {
      recognition.start();
      
      // Auto-stop after 10 seconds (iOS doesn't support long continuous listening)
      timeoutRef.current = setTimeout(() => {
        if (isActiveRef.current) {
          console.log('[PTT] Auto-stopping after timeout');
          setDebugInfo('Auto-stopping...');
          stopListening();
        }
      }, 10000);
      
    } catch (e) {
      console.error('[PTT] Start error:', e);
      setError('Could not start speech recognition. Please try again.');
      setShowResult(true);
      stopListening();
    }
  }, [sourceConfig, doTranslate, stopListening]);

  // Handle button press
  const handlePress = () => {
    if (isListening) {
      // Stop and translate what we have
      const captured = finalTranscriptRef.current.trim() || transcript.trim();
      stopListening();
      if (captured) {
        doTranslate(captured);
      } else {
        setError('No speech detected. Tap and speak clearly.');
        setShowResult(true);
      }
    } else if (!isTranslating) {
      startListening();
    }
  };

  // Speak the translation
  const speakResult = () => {
    if (!translation || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(translation);
    utterance.lang = targetConfig.speech;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // Close result modal
  const closeResult = () => {
    setShowResult(false);
    setTranscript('');
    setTranslation('');
    setError('');
    setDebugInfo('');
  };

  return (
    <>
      {/* Language Indicator Badge */}
      <div className="ptt-lang-badge" data-testid="ptt-language-badge">
        <span className="ptt-lang-flag">{sourceConfig.flag}</span>
        <ChevronRight className="ptt-lang-arrow" />
        <span className="ptt-lang-flag">{targetConfig.flag}</span>
      </div>

      {/* Push-to-Talk Button - Transparent Glass Design */}
      <button
        onClick={handlePress}
        disabled={isTranslating}
        className={`ptt-glass-btn ${isListening ? 'listening' : ''} ${isTranslating ? 'translating' : ''}`}
        data-testid="push-to-talk-btn"
        aria-label={isListening ? 'Stop recording' : 'Start voice translation'}
      >
        <div className="ptt-glass-inner">
          {isTranslating ? (
            <Loader2 className="ptt-icon animate-spin" />
          ) : isListening ? (
            <MicOff className="ptt-icon" />
          ) : (
            <Mic className="ptt-icon" />
          )}
        </div>
        {isListening && <span className="ptt-glass-pulse" />}
      </button>

      {/* Live Transcript Indicator */}
      {isListening && (
        <div className="ptt-live-transcript">
          <div className="ptt-live-header">
            <span className="ptt-live-dot" />
            <span>{sourceConfig.flag} Listening...</span>
          </div>
          {transcript && (
            <p className="ptt-live-text">{transcript}</p>
          )}
        </div>
      )}

      {/* Result Modal */}
      {showResult && createPortal(
        <div className="ptt-modal-overlay" onClick={closeResult}>
          <div className="ptt-modal-glass" onClick={e => e.stopPropagation()}>
            <div className="ptt-modal-header">
              <div className="ptt-modal-icon">
                <Globe className="w-5 h-5" />
              </div>
              <h3>Voice Translation</h3>
              <button onClick={closeResult} className="ptt-modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="ptt-modal-content">
              {error ? (
                <div className="ptt-error-box">
                  <AlertCircle className="w-5 h-5" />
                  <p>{error}</p>
                  <button onClick={() => { closeResult(); startListening(); }} className="ptt-retry-btn">
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  {transcript && (
                    <div className="ptt-result-box ptt-source">
                      <div className="ptt-result-label">
                        {sourceConfig.flag} {sourceConfig.name}
                      </div>
                      <p>{transcript}</p>
                    </div>
                  )}
                  
                  {translation && (
                    <div className="ptt-result-box ptt-target">
                      <div className="ptt-result-label">
                        {targetConfig.flag} {targetConfig.name}
                      </div>
                      <p>{translation}</p>
                      <button onClick={speakResult} className="ptt-speak-btn">
                        <Volume2 className="w-4 h-4" />
                        Read Aloud
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        /* ==========================================
           PTT GLASS BUTTON - Transparent Effect
           Matching Quick Add Bluetooth Style
           ========================================== */
        
        .ptt-lang-badge {
          position: fixed;
          right: 14px;
          bottom: 218px;
          z-index: 49;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: linear-gradient(180deg, 
            rgba(20, 25, 35, 0.7) 0%, 
            rgba(10, 15, 22, 0.85) 100%
          );
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 20px;
          box-shadow: 
            0 4px 12px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .ptt-lang-flag {
          font-size: 14px;
          line-height: 1;
        }

        .ptt-lang-arrow {
          width: 12px;
          height: 12px;
          color: rgba(139, 92, 246, 0.7);
        }

        /* Main PTT Button - Glass Effect */
        .ptt-glass-btn {
          position: fixed;
          right: 16px;
          bottom: 156px;
          z-index: 50;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(145deg, 
            rgba(139, 92, 246, 0.15) 0%, 
            rgba(109, 40, 217, 0.25) 100%
          );
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 2px solid rgba(139, 92, 246, 0.4);
          box-shadow: 
            0 4px 20px rgba(139, 92, 246, 0.3),
            0 0 30px rgba(139, 92, 246, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          overflow: visible;
          -webkit-tap-highlight-color: transparent;
        }

        .ptt-glass-btn:hover:not(:disabled) {
          transform: scale(1.08);
          border-color: rgba(139, 92, 246, 0.6);
          box-shadow: 
            0 6px 30px rgba(139, 92, 246, 0.4),
            0 0 40px rgba(139, 92, 246, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .ptt-glass-btn:active:not(:disabled) {
          transform: scale(0.95);
        }

        .ptt-glass-btn:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        .ptt-glass-inner {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ptt-icon {
          width: 24px;
          height: 24px;
          color: rgba(167, 139, 250, 0.9);
          filter: drop-shadow(0 0 4px rgba(139, 92, 246, 0.5));
          transition: color 0.2s;
        }

        /* Listening State */
        .ptt-glass-btn.listening {
          background: linear-gradient(145deg, 
            rgba(239, 68, 68, 0.2) 0%, 
            rgba(220, 38, 38, 0.3) 100%
          );
          border-color: rgba(239, 68, 68, 0.5);
          box-shadow: 
            0 4px 25px rgba(239, 68, 68, 0.4),
            0 0 40px rgba(239, 68, 68, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          animation: ptt-glow 1.5s ease-in-out infinite;
        }

        .ptt-glass-btn.listening .ptt-icon {
          color: #ef4444;
          filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.6));
        }

        @keyframes ptt-glow {
          0%, 100% { box-shadow: 0 4px 25px rgba(239, 68, 68, 0.4), 0 0 40px rgba(239, 68, 68, 0.2); }
          50% { box-shadow: 0 4px 35px rgba(239, 68, 68, 0.6), 0 0 50px rgba(239, 68, 68, 0.3); }
        }

        /* Translating State */
        .ptt-glass-btn.translating {
          background: linear-gradient(145deg, 
            rgba(34, 211, 238, 0.15) 0%, 
            rgba(6, 182, 212, 0.25) 100%
          );
          border-color: rgba(34, 211, 238, 0.5);
        }

        .ptt-glass-btn.translating .ptt-icon {
          color: #22d3ee;
        }

        /* Pulse Ring */
        .ptt-glass-pulse {
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 2px solid rgba(239, 68, 68, 0.5);
          animation: ptt-pulse-ring 1.2s ease-out infinite;
          pointer-events: none;
        }

        @keyframes ptt-pulse-ring {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }

        /* Live Transcript Box */
        .ptt-live-transcript {
          position: fixed;
          bottom: 220px;
          left: 16px;
          right: 84px;
          padding: 14px 16px;
          background: linear-gradient(180deg, 
            rgba(15, 15, 20, 0.92) 0%, 
            rgba(10, 10, 15, 0.95) 100%
          );
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 16px;
          z-index: 48;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          animation: ptt-slide-in 0.2s ease;
        }

        @keyframes ptt-slide-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ptt-live-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 8px;
        }

        .ptt-live-dot {
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          animation: ptt-dot-pulse 1s ease-in-out infinite;
        }

        @keyframes ptt-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        .ptt-live-text {
          margin: 0;
          font-size: 15px;
          color: #fff;
          line-height: 1.5;
        }

        /* Modal Overlay */
        .ptt-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: ptt-fade-in 0.2s ease;
        }

        @keyframes ptt-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Modal Glass Card */
        .ptt-modal-glass {
          width: 100%;
          max-width: 360px;
          background: linear-gradient(180deg, 
            rgba(25, 20, 35, 0.9) 0%, 
            rgba(15, 12, 22, 0.95) 100%
          );
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border-radius: 24px;
          border: 1px solid rgba(139, 92, 246, 0.25);
          box-shadow: 
            0 25px 50px rgba(0, 0, 0, 0.5),
            0 0 60px rgba(139, 92, 246, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          overflow: hidden;
          animation: ptt-modal-slide 0.25s ease;
        }

        @keyframes ptt-modal-slide {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .ptt-modal-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(139, 92, 246, 0.15);
          background: linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, transparent 100%);
        }

        .ptt-modal-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(139, 92, 246, 0.15);
          border: 1px solid rgba(139, 92, 246, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
        }

        .ptt-modal-header h3 {
          flex: 1;
          font-size: 16px;
          font-weight: 600;
          color: #a78bfa;
          margin: 0;
          text-shadow: 0 0 10px rgba(139, 92, 246, 0.3);
        }

        .ptt-modal-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .ptt-modal-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .ptt-modal-content {
          padding: 20px;
        }

        /* Error Box */
        .ptt-error-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 20px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 16px;
          text-align: center;
        }

        .ptt-error-box svg:first-child {
          color: #ef4444;
        }

        .ptt-error-box p {
          margin: 0;
          font-size: 14px;
          color: #fca5a5;
          line-height: 1.5;
        }

        .ptt-retry-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          margin-top: 8px;
          background: rgba(139, 92, 246, 0.15);
          border: 1px solid rgba(139, 92, 246, 0.4);
          border-radius: 10px;
          color: #a78bfa;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ptt-retry-btn:hover {
          background: rgba(139, 92, 246, 0.25);
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.2);
        }

        /* Result Boxes */
        .ptt-result-box {
          padding: 16px;
          border-radius: 14px;
          margin-bottom: 12px;
        }

        .ptt-result-box:last-child {
          margin-bottom: 0;
        }

        .ptt-source {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ptt-target {
          background: linear-gradient(135deg, 
            rgba(139, 92, 246, 0.1) 0%, 
            rgba(109, 40, 217, 0.08) 100%
          );
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        .ptt-result-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 10px;
        }

        .ptt-target .ptt-result-label {
          color: #a78bfa;
        }

        .ptt-result-box p {
          margin: 0;
          font-size: 15px;
          color: #fff;
          line-height: 1.6;
        }

        .ptt-speak-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 14px;
          padding: 10px 16px;
          background: rgba(139, 92, 246, 0.12);
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 10px;
          color: #a78bfa;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ptt-speak-btn:hover {
          background: rgba(139, 92, 246, 0.2);
        }

        .ptt-speak-btn:active {
          transform: scale(0.98);
        }
      `}</style>
    </>
  );
};

export default VoiceTranslator;
