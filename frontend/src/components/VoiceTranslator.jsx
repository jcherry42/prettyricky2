import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Check for speech recognition support (Safari uses webkit prefix)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

// Detect Safari
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

/**
 * Voice Translator - Push to Start Button
 * Records Spanish voice input and translates to English text
 */
export const VoiceTranslator = () => {
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [spanishText, setSpanishText] = useState('');
  const [englishText, setEnglishText] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState('');
  
  const recognitionRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const latestTextRef = useRef(''); // Track latest transcript

  // Translate Spanish to English
  const translateToEnglish = useCallback(async (text) => {
    if (!text.trim()) return;
    
    setIsTranslating(true);
    setError('');
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          source_lang: 'es',
          target_lang: 'en'
        })
      });
      
      if (!response.ok) throw new Error('Translation failed');
      
      const data = await response.json();
      setEnglishText(data.translated_text || data.translation || text);
      
      // Auto-hide after 8 seconds
      hideTimeoutRef.current = setTimeout(() => {
        setShowResults(false);
      }, 8000);
      
    } catch (err) {
      setError('Translation unavailable');
      setEnglishText('');
    } finally {
      setIsTranslating(false);
    }
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSpeechSupported) return;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = !isSafari; // Safari doesn't handle interim results well
    recognition.lang = 'es-US'; // Spanish (US)
    recognition.maxAlternatives = 1;
    
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setSpanishText(transcript);
      latestTextRef.current = transcript; // Store in ref for onend
      setShowResults(true);
      
      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      
      // For Safari - translate immediately on final result
      if (isSafari && event.results[event.results.length - 1].isFinal) {
        translateToEnglish(transcript);
      }
    };
    
    recognition.onend = () => {
      setIsListening(false);
      // Use ref to get latest text (avoids stale closure)
      // Skip if Safari already translated on final result
      if (!isSafari) {
        const textToTranslate = latestTextRef.current;
        if (textToTranslate) {
          translateToEnglish(textToTranslate);
        }
      }
    };
    
    recognition.onerror = (event) => {
      setIsListening(false);
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Check Safari Settings > Websites > Microphone');
        setShowResults(true);
      } else if (event.error === 'no-speech') {
        setError('No speech detected. Tap and speak Spanish.');
        setShowResults(true);
      } else if (event.error === 'network') {
        setError('Network error. Check your connection.');
        setShowResults(true);
      } else if (event.error !== 'aborted') {
        setError(`Error: ${event.error}`);
        setShowResults(true);
      }
    };
    
    recognition.onaudiostart = () => {
      console.log('Audio capture started');
    };
    
    recognitionRef.current = recognition;
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [translateToEnglish]);

  // Toggle listening
  const toggleListening = async () => {
    if (!isSpeechSupported) {
      setError('Speech recognition not supported in this browser');
      setShowResults(true);
      return;
    }
    
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      // Reset state
      setSpanishText('');
      setEnglishText('');
      setError('');
      latestTextRef.current = ''; // Clear the ref
      setShowResults(true);
      
      // Request microphone permission explicitly first (Safari requirement)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately - we just needed permission
        stream.getTracks().forEach(track => track.stop());
      } catch (micError) {
        console.error('Microphone error:', micError);
        if (micError.name === 'NotAllowedError' || micError.name === 'PermissionDeniedError') {
          setError('Microphone access denied. Please enable in Safari Settings > Websites > Microphone');
        } else if (micError.name === 'NotFoundError') {
          setError('No microphone found on this device');
        } else {
          setError(`Microphone error: ${micError.message}`);
        }
        return;
      }
      
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        setError('Could not start microphone');
      }
    }
  };

  // Hide results manually
  const hideResults = () => {
    setShowResults(false);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
  };

  return (
    <div 
      className="voice-translator-panel"
      style={{ position: 'fixed', right: '20px', left: 'auto', top: '50%', transform: 'translateY(-50%)', zIndex: 50 }}
    >
      {/* Push to Start Button */}
      <button
        onClick={toggleListening}
        className={`push-to-start-btn ${isListening ? 'active' : ''} ${isTranslating ? 'translating' : ''}`}
        disabled={isTranslating}
        title={isListening ? 'Stop listening' : 'Push to speak Spanish'}
        data-testid="voice-translator-btn"
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'linear-gradient(145deg, #2a2a35 0%, #1a1a22 50%, #0f0f14 100%)',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          position: 'relative'
        }}
      >
        <div style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #3a3a45 0%, #25252d 100%)',
          padding: '3px',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)'
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: isListening 
              ? 'linear-gradient(180deg, #2a1a1a 0%, #1a0f0f 100%)' 
              : 'linear-gradient(180deg, #1c1c24 0%, #12121a 100%)',
            border: isListening ? '2px solid #cc3333' : '2px solid #333340',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px'
          }}>
            <div style={{ color: isListening ? '#ff4444' : '#666' }}>
              {isListening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </div>
            <div style={{
              fontFamily: "'Russo One', sans-serif",
              fontSize: '8px',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              color: isListening ? '#ff6666' : '#555'
            }}>
              {isTranslating ? 'WAIT' : isListening ? 'STOP' : 'PUSH'}
            </div>
          </div>
        </div>
        {/* Glow ring when active */}
        {isListening && (
          <div style={{
            position: 'absolute',
            inset: '-4px',
            borderRadius: '50%',
            border: '2px solid #ff4444',
            boxShadow: '0 0 20px rgba(255,68,68,0.4), 0 0 40px rgba(255,68,68,0.2)',
            animation: 'glow-pulse 1.5s ease-in-out infinite',
            pointerEvents: 'none'
          }}></div>
        )}
      </button>
      
      {/* Auto-hiding text results */}
      <div className={`voice-results ${showResults ? 'visible' : 'hidden'}`}>
        {error ? (
          <div className="voice-result-box error">
            <span className="result-label">ERROR</span>
            <p>{error}</p>
          </div>
        ) : (
          <>
            {spanishText && (
              <div className="voice-result-box spanish">
                <span className="result-label">🇪🇸 ESPAÑOL</span>
                <p>{spanishText}</p>
              </div>
            )}
            {englishText && (
              <div className="voice-result-box english">
                <span className="result-label">🇺🇸 ENGLISH</span>
                <p>{englishText}</p>
              </div>
            )}
            {isListening && !spanishText && (
              <div className="voice-result-box listening">
                <span className="result-label">LISTENING...</span>
                <p className="listening-dots">
                  <span>●</span><span>●</span><span>●</span>
                </p>
              </div>
            )}
            {isTranslating && (
              <div className="voice-result-box translating">
                <span className="result-label">TRANSLATING...</span>
              </div>
            )}
          </>
        )}
        
        {showResults && (spanishText || englishText || error) && (
          <button onClick={hideResults} className="hide-results-btn">
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceTranslator;
