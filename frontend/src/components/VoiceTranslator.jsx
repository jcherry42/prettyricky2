import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2, Volume2, X, Globe, ChevronDown } from 'lucide-react';
import haptics from '../utils/haptics';
import { announceToScreenReader } from '../utils/accessibility';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Check for speech recognition support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

// Language config with enhanced data
const LANG_CONFIG = {
  en: { name: 'English', flag: '🇺🇸', speech: 'en-US', code: 'en' },
  es: { name: 'Spanish', flag: '🇪🇸', speech: 'es-US', code: 'es' },
  fr: { name: 'French', flag: '🇫🇷', speech: 'fr-FR', code: 'fr' },
  ja: { name: 'Japanese', flag: '🇯🇵', speech: 'ja-JP', code: 'ja' },
  ko: { name: 'Korean', flag: '🇰🇷', speech: 'ko-KR', code: 'ko' },
};

/**
 * Enterprise-Grade Push-to-Talk Voice Translator
 * Features:
 * - Syncs with app's translation language setting
 * - Press to start, press again to stop and translate
 * - Language indicator badge
 * - Proper accessibility and haptic feedback
 * - Error recovery with retry
 */
export const VoiceTranslator = () => {
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const isActiveRef = useRef(false);

  // Get target language from localStorage (default to Spanish)
  const targetLang = localStorage.getItem('defaultTargetLanguage') || 'es';
  const sourceLang = targetLang === 'en' ? 'es' : 'en';
  
  const sourceConfig = LANG_CONFIG[sourceLang] || LANG_CONFIG.en;
  const targetConfig = LANG_CONFIG[targetLang] || LANG_CONFIG.es;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
      }
    };
  }, []);

  // Translate the transcript
  const doTranslate = useCallback(async (text, attempt = 0) => {
    if (!text.trim()) {
      setError('No speech detected. Please try again.');
      setShowResult(true);
      announceToScreenReader('No speech detected');
      return;
    }
    
    setIsTranslating(true);
    setError('');
    
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
      
      if (!res.ok) throw new Error('Translation failed');
      
      const data = await res.json();
      setTranslation(data.translated_text || '');
      setShowResult(true);
      setRetryCount(0);
      haptics.success();
      announceToScreenReader(`Translated to ${targetConfig.name}`);
    } catch (err) {
      console.error('[VoiceTranslator] Error:', err);
      
      // Retry logic
      if (attempt < 2) {
        setRetryCount(attempt + 1);
        setTimeout(() => doTranslate(text, attempt + 1), 1000);
        return;
      }
      
      setError('Translation failed. Please check your connection and try again.');
      setShowResult(true);
      haptics.error();
      announceToScreenReader('Translation failed');
    } finally {
      setIsTranslating(false);
    }
  }, [sourceLang, targetLang, targetConfig.name]);

  // Handle push-to-talk
  const handlePush = async () => {
    haptics.button();
    
    if (!isSpeechSupported) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Safari.');
      setShowResult(true);
      return;
    }

    if (isListening) {
      // STOP listening
      isActiveRef.current = false;
      setIsListening(false);
      
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
      }
      
      // Translate what we captured
      if (transcriptRef.current.trim()) {
        doTranslate(transcriptRef.current);
      } else {
        setError('No speech detected. Please speak clearly and try again.');
        setShowResult(true);
      }
    } else {
      // START listening
      setTranscript('');
      setTranslation('');
      setError('');
      setShowResult(false);
      transcriptRef.current = '';
      
      // Request microphone permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
      } catch (e) {
        setError('Microphone access denied. Please enable microphone in your browser settings.');
        setShowResult(true);
        haptics.error();
        return;
      }
      
      // Create fresh recognition instance each time
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = sourceConfig.speech;
      recognition.maxAlternatives = 1;
      
      recognition.onresult = (event) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        transcriptRef.current = text;
        setTranscript(text);
      };
      
      recognition.onerror = (event) => {
        console.error('[VoiceTranslator] Recognition error:', event.error);
        if (event.error === 'no-speech') {
          setError('No speech detected. Please speak clearly and try again.');
        } else if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please enable microphone permissions.');
        } else if (event.error === 'network') {
          setError('Network error. Please check your connection.');
        } else if (event.error !== 'aborted') {
          setError('Recognition error. Please try again.');
        }
        isActiveRef.current = false;
        setIsListening(false);
        if (event.error !== 'aborted') {
          setShowResult(true);
          haptics.error();
        }
      };
      
      recognition.onend = () => {
        if (isActiveRef.current && transcriptRef.current.trim()) {
          doTranslate(transcriptRef.current);
        }
        isActiveRef.current = false;
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
      isActiveRef.current = true;
      
      try {
        recognition.start();
        setIsListening(true);
        haptics.tap();
        announceToScreenReader(`Listening in ${sourceConfig.name}`);
      } catch (e) {
        console.error('[VoiceTranslator] Start error:', e);
        setError('Could not start microphone. Please try again.');
        setShowResult(true);
        isActiveRef.current = false;
        haptics.error();
      }
    }
  };

  // Speak the translation
  const speakResult = () => {
    if (!translation || !('speechSynthesis' in window)) return;
    haptics.tap();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(translation);
    utterance.lang = targetConfig.speech;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
    announceToScreenReader('Reading translation aloud');
  };

  // Retry translation
  const handleRetry = () => {
    haptics.button();
    if (transcriptRef.current.trim()) {
      doTranslate(transcriptRef.current);
    } else {
      handlePush();
    }
  };

  // Close result panel
  const closeResult = () => {
    haptics.tap();
    setShowResult(false);
    setTranscript('');
    setTranslation('');
    setError('');
  };

  return (
    <>
      {/* Language Indicator Badge - Shows current translation direction */}
      <div className="ptt-lang-badge" data-testid="ptt-language-badge">
        <span className="ptt-lang-from">{sourceConfig.flag}</span>
        <ChevronDown className="ptt-lang-arrow" />
        <span className="ptt-lang-to">{targetConfig.flag}</span>
      </div>

      {/* Push-to-Talk Button */}
      <button
        onClick={handlePush}
        disabled={isTranslating}
        className={`ptt-button ${isListening ? 'listening' : ''} ${isTranslating ? 'busy' : ''}`}
        data-testid="push-to-talk-btn"
        aria-label={isListening ? 'Stop recording and translate' : `Start recording in ${sourceConfig.name}`}
        aria-pressed={isListening}
      >
        {isTranslating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isListening ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
        {isListening && <span className="ptt-pulse" aria-hidden="true" />}
      </button>

      {/* Live transcript indicator */}
      {isListening && transcript && (
        <div className="ptt-transcript" role="status" aria-live="polite">
          <span className="ptt-transcript-flag" aria-hidden="true">{sourceConfig.flag}</span>
          <span className="ptt-transcript-text">{transcript}</span>
        </div>
      )}

      {/* Retry indicator */}
      {isTranslating && retryCount > 0 && (
        <div className="ptt-retry-indicator">
          Retrying... ({retryCount}/2)
        </div>
      )}

      {/* Result Modal */}
      {showResult && (
        <div 
          className="ptt-modal-overlay" 
          onClick={closeResult}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ptt-result-title"
        >
          <div className="ptt-modal" onClick={e => e.stopPropagation()}>
            <div className="ptt-modal-header">
              <h3 id="ptt-result-title" className="ptt-modal-title">
                <Globe className="w-4 h-4" />
                Translation
              </h3>
              <button 
                onClick={closeResult} 
                className="ptt-modal-close"
                aria-label="Close translation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error ? (
              <div className="ptt-error" role="alert">
                <p>{error}</p>
                <button onClick={handleRetry} className="ptt-retry-btn">
                  Try Again
                </button>
              </div>
            ) : (
              <>
                {transcript && (
                  <div className="ptt-result-section ptt-source">
                    <div className="ptt-result-label">
                      {sourceConfig.flag} {sourceConfig.name}
                    </div>
                    <p>{transcript}</p>
                  </div>
                )}
                {translation && (
                  <div className="ptt-result-section ptt-target">
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
      )}

      <style>{`
        /* Language Badge - Above PTT button */
        .ptt-lang-badge {
          position: fixed;
          right: 14px;
          bottom: 218px;
          z-index: 44;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: linear-gradient(180deg, rgba(30, 30, 35, 0.95) 0%, rgba(20, 20, 25, 0.98) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .ptt-lang-from, .ptt-lang-to {
          font-size: 14px;
        }

        .ptt-lang-arrow {
          width: 12px;
          height: 12px;
          color: rgba(255, 255, 255, 0.4);
          transform: rotate(-90deg);
        }

        /* Push-to-Talk Button */
        .ptt-button {
          position: fixed;
          right: 16px;
          bottom: 156px;
          z-index: 45;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(145deg, #252530 0%, #1a1a22 100%);
          border: 2px solid #3a3a45;
          color: #888;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
          transition: all 0.2s ease;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        .ptt-button:hover:not(:disabled) {
          border-color: #4a4a55;
          color: #aaa;
        }

        .ptt-button:active:not(:disabled) {
          transform: scale(0.95);
        }

        .ptt-button:focus-visible {
          outline: 2px solid #22d3ee;
          outline-offset: 2px;
        }

        .ptt-button.listening {
          border-color: #ef4444;
          color: #ef4444;
          box-shadow: 0 0 25px rgba(239, 68, 68, 0.35);
          animation: pttGlow 1.5s ease-in-out infinite;
        }

        @keyframes pttGlow {
          0%, 100% { box-shadow: 0 0 25px rgba(239, 68, 68, 0.35); }
          50% { box-shadow: 0 0 35px rgba(239, 68, 68, 0.5); }
        }

        .ptt-button.busy {
          border-color: #22d3ee;
          color: #22d3ee;
          opacity: 0.9;
          cursor: wait;
        }

        .ptt-pulse {
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 2px solid #ef4444;
          animation: ptt-ring 1.2s ease-out infinite;
          pointer-events: none;
        }

        @keyframes ptt-ring {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.35); opacity: 0; }
        }

        /* Live Transcript */
        .ptt-transcript {
          position: fixed;
          bottom: 220px;
          left: 16px;
          right: 84px;
          padding: 14px 16px;
          background: linear-gradient(180deg, rgba(15, 15, 18, 0.95) 0%, rgba(10, 10, 12, 0.98) 100%);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 14px;
          z-index: 44;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          animation: slideIn 0.2s ease;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ptt-transcript-flag {
          font-size: 18px;
          flex-shrink: 0;
        }

        .ptt-transcript-text {
          color: #fff;
          font-size: 14px;
          line-height: 1.5;
        }

        /* Retry Indicator */
        .ptt-retry-indicator {
          position: fixed;
          bottom: 280px;
          right: 16px;
          padding: 6px 12px;
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          color: #f59e0b;
          font-size: 11px;
          font-weight: 600;
          z-index: 44;
        }

        /* Modal */
        .ptt-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.88);
          backdrop-filter: blur(8px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .ptt-modal {
          width: 100%;
          max-width: 360px;
          background: linear-gradient(180deg, rgba(28, 30, 38, 0.98) 0%, rgba(18, 20, 26, 0.99) 100%);
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          overflow: hidden;
          animation: slideUp 0.25s ease;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .ptt-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ptt-modal-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .ptt-modal-title svg {
          color: #22d3ee;
        }

        .ptt-modal-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ptt-modal-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .ptt-error {
          padding: 24px 20px;
          text-align: center;
        }

        .ptt-error p {
          margin: 0 0 16px 0;
          padding: 14px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
          color: #fca5a5;
          font-size: 14px;
          line-height: 1.5;
        }

        .ptt-retry-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 24px;
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%);
          border: 1px solid rgba(34, 211, 238, 0.4);
          border-radius: 10px;
          color: #22d3ee;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ptt-retry-btn:hover {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.3) 0%, rgba(6, 182, 212, 0.25) 100%);
          box-shadow: 0 0 20px rgba(34, 211, 238, 0.2);
        }

        .ptt-result-section {
          padding: 16px 20px;
        }

        .ptt-source {
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .ptt-target {
          background: linear-gradient(180deg, rgba(34, 211, 238, 0.05) 0%, rgba(6, 182, 212, 0.03) 100%);
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
          color: #22d3ee;
        }

        .ptt-result-section p {
          margin: 0;
          color: #fff;
          font-size: 15px;
          line-height: 1.6;
        }

        .ptt-speak-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 14px;
          padding: 10px 16px;
          background: rgba(34, 211, 238, 0.12);
          border: 1px solid rgba(34, 211, 238, 0.25);
          border-radius: 10px;
          color: #22d3ee;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ptt-speak-btn:hover {
          background: rgba(34, 211, 238, 0.2);
        }

        .ptt-speak-btn:active {
          transform: scale(0.98);
        }
      `}</style>
    </>
  );
};

export default VoiceTranslator;
