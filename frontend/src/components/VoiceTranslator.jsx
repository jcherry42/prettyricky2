import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2, Volume2, X } from 'lucide-react';
import { useSales } from '../context/SalesContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Check for speech recognition support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

// Language config
const LANG_CONFIG = {
  en: { name: 'English', flag: '🇺🇸', speech: 'en-US' },
  es: { name: 'Spanish', flag: '🇪🇸', speech: 'es-US' },
  fr: { name: 'French', flag: '🇫🇷', speech: 'fr-FR' },
  ja: { name: 'Japanese', flag: '🇯🇵', speech: 'ja-JP' },
  ko: { name: 'Korean', flag: '🇰🇷', speech: 'ko-KR' },
};

/**
 * Simplified Push-to-Talk Voice Translator
 * - Syncs with app's translation language setting
 * - Press to start, press again to stop and translate
 * - Clean, stable implementation
 */
export const VoiceTranslator = () => {
  const { preferences } = useSales();
  
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState('');
  const [showResult, setShowResult] = useState(false);
  
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const isActiveRef = useRef(false);

  // Get target language from app preferences (default to Spanish)
  const targetLang = preferences?.translationLanguage || 'es';
  const sourceLang = targetLang === 'en' ? 'es' : 'en'; // If target is English, source is Spanish, otherwise source is English
  
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
  const doTranslate = useCallback(async (text) => {
    if (!text.trim()) {
      setError('No speech detected. Try again.');
      setShowResult(true);
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
    } catch (err) {
      console.error('[VoiceTranslator] Error:', err);
      setError('Translation failed. Check connection.');
      setShowResult(true);
    } finally {
      setIsTranslating(false);
    }
  }, [sourceLang, targetLang]);

  // Handle push-to-talk
  const handlePush = async () => {
    if (!isSpeechSupported) {
      setError('Speech recognition not supported in this browser');
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
        setError('No speech detected. Try again.');
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
        setError('Microphone access denied');
        setShowResult(true);
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
          setError('No speech detected. Try again.');
        } else if (event.error === 'not-allowed') {
          setError('Microphone access denied');
        } else if (event.error !== 'aborted') {
          setError('Recognition error. Try again.');
        }
        isActiveRef.current = false;
        setIsListening(false);
        setShowResult(true);
      };
      
      recognition.onend = () => {
        // Only auto-translate if we were actively listening (not manually stopped)
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
      } catch (e) {
        console.error('[VoiceTranslator] Start error:', e);
        setError('Could not start microphone');
        setShowResult(true);
        isActiveRef.current = false;
      }
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

  // Close result panel
  const closeResult = () => {
    setShowResult(false);
    setTranscript('');
    setTranslation('');
    setError('');
  };

  return (
    <>
      {/* Push-to-Talk Button - Positioned near Quick Add button */}
      <button
        onClick={handlePush}
        disabled={isTranslating}
        className={`ptt-button ${isListening ? 'listening' : ''} ${isTranslating ? 'busy' : ''}`}
        data-testid="push-to-talk-btn"
        aria-label={isListening ? 'Stop recording' : 'Start recording'}
      >
        {isTranslating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isListening ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
        {isListening && <span className="ptt-pulse" />}
      </button>

      {/* Live transcript indicator */}
      {isListening && transcript && (
        <div className="ptt-transcript">
          <span className="ptt-transcript-flag">{sourceConfig.flag}</span>
          <span className="ptt-transcript-text">{transcript}</span>
        </div>
      )}

      {/* Result Modal */}
      {showResult && (
        <div className="ptt-modal-overlay" onClick={closeResult}>
          <div className="ptt-modal" onClick={e => e.stopPropagation()}>
            <button onClick={closeResult} className="ptt-modal-close">
              <X className="w-4 h-4" />
            </button>

            {error ? (
              <div className="ptt-error">{error}</div>
            ) : (
              <>
                {transcript && (
                  <div className="ptt-result-section ptt-source">
                    <div className="ptt-result-label">{sourceConfig.flag} {sourceConfig.name}</div>
                    <p>{transcript}</p>
                  </div>
                )}
                {translation && (
                  <div className="ptt-result-section ptt-target">
                    <div className="ptt-result-label">{targetConfig.flag} {targetConfig.name}</div>
                    <p>{translation}</p>
                    <button onClick={speakResult} className="ptt-speak-btn">
                      <Volume2 className="w-4 h-4" />
                      Speak
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .ptt-button {
          position: fixed;
          right: 16px;
          bottom: 100px;
          z-index: 45;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: linear-gradient(145deg, #252530 0%, #1a1a22 100%);
          border: 2px solid #333;
          color: #888;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(0,0,0,0.4);
          transition: all 0.2s ease;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        .ptt-button:active {
          transform: scale(0.95);
        }

        .ptt-button.listening {
          border-color: #ef4444;
          color: #ef4444;
          box-shadow: 0 0 20px rgba(239,68,68,0.3);
        }

        .ptt-button.busy {
          border-color: #22d3ee;
          color: #22d3ee;
          opacity: 0.8;
          cursor: wait;
        }

        .ptt-pulse {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid #ef4444;
          animation: ptt-ring 1s ease-out infinite;
          pointer-events: none;
        }

        @keyframes ptt-ring {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.3); opacity: 0; }
        }

        .ptt-transcript {
          position: fixed;
          bottom: 160px;
          left: 16px;
          right: 80px;
          padding: 12px 16px;
          background: rgba(0,0,0,0.9);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 12px;
          z-index: 44;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .ptt-transcript-flag {
          font-size: 16px;
          flex-shrink: 0;
        }

        .ptt-transcript-text {
          color: #fff;
          font-size: 14px;
          line-height: 1.4;
        }

        .ptt-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(4px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .ptt-modal {
          width: 100%;
          max-width: 340px;
          background: linear-gradient(180deg, rgba(28,30,38,0.98) 0%, rgba(18,20,26,0.98) 100%);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.1);
          padding: 20px;
          position: relative;
        }

        .ptt-modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          border: none;
          color: #888;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .ptt-error {
          padding: 16px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          color: #fca5a5;
          text-align: center;
          font-size: 14px;
        }

        .ptt-result-section {
          padding: 14px;
          border-radius: 10px;
          margin-bottom: 10px;
        }

        .ptt-source {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .ptt-target {
          background: rgba(34,211,238,0.08);
          border: 1px solid rgba(34,211,238,0.2);
        }

        .ptt-result-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #888;
          margin-bottom: 8px;
        }

        .ptt-target .ptt-result-label {
          color: #22d3ee;
        }

        .ptt-result-section p {
          margin: 0;
          color: #fff;
          font-size: 15px;
          line-height: 1.5;
        }

        .ptt-speak-btn {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(34,211,238,0.15);
          border: 1px solid rgba(34,211,238,0.25);
          border-radius: 8px;
          color: #22d3ee;
          font-size: 13px;
          cursor: pointer;
        }

        .ptt-speak-btn:active {
          background: rgba(34,211,238,0.25);
        }
      `}</style>
    </>
  );
};

export default VoiceTranslator;
