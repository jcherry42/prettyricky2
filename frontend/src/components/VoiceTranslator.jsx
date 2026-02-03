import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { Mic, Square, Loader2, Volume2, X, Globe, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { speakText, stopSpeech } from '../utils/ttsService';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

// Language config - Spanish, French, Korean only
const LANG_CONFIG = {
  es: { name: 'Spanish', flag: '🇪🇸', code: 'es' },
  fr: { name: 'French', flag: '🇫🇷', code: 'fr' },
  ko: { name: 'Korean', flag: '🇰🇷', code: 'ko' },
};

/**
 * Push-to-Talk Voice Translator
 * Uses MediaRecorder for audio capture (reliable on iOS)
 * Backend Whisper for transcription (bypasses buggy Web Speech API)
 */
export const VoiceTranslator = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // Get target language from localStorage
  // App setting defines the customer's language (es, fr, ko)
  const customerLang = localStorage.getItem('defaultTargetLanguage') || 'es';
  // Customer speaks customerLang, rep wants English text
  const sourceLang = customerLang; // es / fr / ko from Settings
  const targetLang = 'en';
  
  const sourceConfig = LANG_CONFIG[sourceLang] || LANG_CONFIG.es;
  const targetConfig = { name: 'English', flag: 'EN', code: 'en' };

  // Stop recording and cleanup
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Stop error - silent
      }
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  // Process audio and send to backend
  const processAudio = useCallback(async (audioBlob) => {
    setIsProcessing(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('source_lang', sourceLang);
      formData.append('target_lang', targetLang);
      
      const response = await fetch(`${BACKEND_URL}/api/voice-translate`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || 'Server error');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Translation failed');
        setShowResult(true);
        return;
      }
      
      setTranscript(data.transcript);
      setTranslation(data.translated_text);
      setShowResult(true);
      
    } catch (err) {
      const diag = {
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        displayMode:
          (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches)
            ? 'standalone'
            : 'browser',
        origin: typeof window !== 'undefined' ? window.location.origin : '',
        backendUrl: BACKEND_URL,
      };

      setError(err.message || 'Failed to process audio');
      setShowResult(true);

      // High-signal diagnostics
      toast.error('Voice translate failed', {
        description: `${err.message || 'Unable to connect'} · ${diag.displayMode} · origin=${diag.origin} · backend=${diag.backendUrl}`,
        duration: 6000,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [sourceLang, targetLang]);

  // Start recording
  const startRecording = useCallback(async () => {
    setTranscript('');
    setTranslation('');
    setError('');
    setShowResult(false);
    audioChunksRef.current = [];
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      setPermissionDenied(false);
      
      // Determine best mime type for this browser
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav'
      ];
      
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, 
        selectedMimeType ? { mimeType: selectedMimeType } : undefined
      );
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: selectedMimeType || 'audio/webm' 
          });
          
          if (audioBlob.size > 1000) {
            processAudio(audioBlob);
          } else {
            setError('Recording too short. Please speak for at least 1 second.');
            setShowResult(true);
          }
        } else {
          setError('No audio recorded. Please try again.');
          setShowResult(true);
        }
        
        audioChunksRef.current = [];
      };
      
      mediaRecorder.onerror = () => {
        setError('Recording failed. Please try again.');
        stopRecording();
        setShowResult(true);
      };
      
      // Start recording with 500ms chunks
      mediaRecorder.start(500);
      setIsRecording(true);
      
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 30) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setError('Microphone access denied. Please enable in Settings > Safari > Microphone.');
      } else {
        setError(`Could not start recording: ${err.message}`);
      }
      setShowResult(true);
    }
  }, [processAudio, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  // Handle button press
  const handlePress = useCallback(() => {
    if (isProcessing) return;
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, isProcessing, startRecording, stopRecording]);

  // Enterprise TTS - Speak the translation with OpenAI's lifelike voices
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const speakResult = useCallback(async () => {
    if (!translation) return;
    
    // If already speaking, stop
    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
      return;
    }
    
    setIsSpeaking(true);
    
    try {
      await speakText(translation, targetLang, {
        useHD: true,
        speed: 0.95,
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch (err) {
      setIsSpeaking(false);
    }
  }, [translation, targetLang, isSpeaking]);

  const closeResult = useCallback(() => {
    stopSpeech();
    setIsSpeaking(false);
    setShowResult(false);
    setTranscript('');
    setTranslation('');
    setError('');
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Language Indicator Badge */}
      <div className="ptt-lang-badge" data-testid="ptt-language-badge">
        <span className="ptt-lang-flag">{sourceConfig.flag}</span>
        <ChevronRight className="ptt-lang-arrow" />
        <span className="ptt-lang-flag">{targetConfig.flag}</span>
      </div>

      {/* Push-to-Talk Button */}
      <button
        onClick={handlePress}
        disabled={isProcessing}
        className={`ptt-glass-btn ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}
        data-testid="push-to-talk-btn"
        aria-label={isRecording ? 'Stop recording' : 'Start voice translation'}
      >
        <div className="ptt-glass-inner">
          {isProcessing ? (
            <Loader2 className="ptt-icon animate-spin" />
          ) : isRecording ? (
            <Square className="ptt-icon ptt-stop" />
          ) : (
            <Mic className="ptt-icon" />
          )}
        </div>
        {isRecording && <span className="ptt-glass-pulse" />}
      </button>

      {/* Recording Indicator */}
      {isRecording && (
        <div className="ptt-recording-indicator">
          <div className="ptt-rec-dot" />
          <span className="ptt-rec-text">{sourceConfig.flag} Recording... {formatTime(recordingTime)}</span>
          <span className="ptt-rec-hint">Tap to stop</span>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="ptt-processing-indicator">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Transcribing & Translating...</span>
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
                  {permissionDenied ? (
                    <p className="ptt-permission-hint">
                      On iPhone: Go to Settings → Safari → Microphone → Allow
                    </p>
                  ) : (
                    <button onClick={() => { closeResult(); startRecording(); }} className="ptt-retry-btn">
                      <RefreshCw className="w-4 h-4" />
                      Try Again
                    </button>
                  )}
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
                      <button 
                        onClick={speakResult} 
                        className={`ptt-speak-btn ${isSpeaking ? 'speaking' : ''}`}
                        disabled={isSpeaking}
                      >
                        {isSpeaking ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Playing...
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-4 h-4" />
                            Read Aloud
                          </>
                        )}
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
           PTT GLASS BUTTON - Luxury Amber Theme
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
            rgba(25, 20, 15, 0.85) 0%, 
            rgba(15, 12, 8, 0.92) 100%
          );
          backdrop-filter: blur(calc(12px - (var(--reduced-effects) * 6px)));
          -webkit-backdrop-filter: blur(calc(12px - (var(--reduced-effects) * 6px)));
          border: 1px solid rgba(255, 140, 0, 0.25);
          border-radius: 20px;
          box-shadow: 
            0 4px 12px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .ptt-lang-flag {
          font-size: 14px;
          line-height: 1;
        }

        .ptt-lang-arrow {
          width: 12px;
          height: 12px;
          color: rgba(255, 159, 67, 0.7);
        }

        /* Main PTT Button - Luxury Amber Glass */
        .ptt-glass-btn {
          position: fixed;
          right: 16px;
          bottom: 156px;
          z-index: 50;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(145deg, 
            rgba(147, 51, 234, 0.15) 0%, 
            rgba(126, 34, 206, 0.25) 100%
          );
          backdrop-filter: blur(calc(12px - (var(--reduced-effects) * 6px)));
          -webkit-backdrop-filter: blur(calc(12px - (var(--reduced-effects) * 6px)));
          border: 2px solid rgba(147, 51, 234, 0.4);
          box-shadow: 
            0 4px 20px rgba(147, 51, 234, 0.3),
            0 0 30px rgba(147, 51, 234, 0.15),
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
          border-color: rgba(167, 139, 250, 0.6);
          box-shadow: 
            0 6px 30px rgba(147, 51, 234, 0.4),
            0 0 40px rgba(167, 139, 250, 0.25),
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
          color: rgba(192, 132, 252, 0.9);
          filter: drop-shadow(0 0 4px rgba(147, 51, 234, 0.5));
          transition: all 0.2s;
        }

        .ptt-icon.ptt-stop {
          width: 20px;
          height: 20px;
          fill: currentColor;
        }

        /* Recording State */
        .ptt-glass-btn.recording {
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

        .ptt-glass-btn.recording .ptt-icon {
          color: #ef4444;
          filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.6));
        }

        @keyframes ptt-glow {
          0%, 100% { box-shadow: 0 4px 25px rgba(239, 68, 68, 0.4), 0 0 40px rgba(239, 68, 68, 0.2); }
          50% { box-shadow: 0 4px 35px rgba(239, 68, 68, 0.6), 0 0 50px rgba(239, 68, 68, 0.3); }
        }

        /* Processing State */
        .ptt-glass-btn.processing {
          background: linear-gradient(145deg, 
            rgba(34, 211, 238, 0.15) 0%, 
            rgba(6, 182, 212, 0.25) 100%
          );
          border-color: rgba(34, 211, 238, 0.5);
        }

        .ptt-glass-btn.processing .ptt-icon {
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

        /* Recording Indicator */
        .ptt-recording-indicator {
          position: fixed;
          bottom: 220px;
          left: 16px;
          right: 84px;
          padding: 14px 16px;
          background: linear-gradient(180deg, 
            rgba(15, 15, 20, 0.92) 0%, 
            rgba(10, 10, 15, 0.95) 100%
          );
          backdrop-filter: blur(calc(16px - (var(--reduced-effects) * 8px)));
          -webkit-backdrop-filter: blur(calc(16px - (var(--reduced-effects) * 8px)));
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 16px;
          z-index: 48;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          animation: ptt-slide-in 0.2s ease;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        @keyframes ptt-slide-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ptt-rec-dot {
          width: 10px;
          height: 10px;
          background: #ef4444;
          border-radius: 50%;
          animation: ptt-dot-pulse 1s ease-in-out infinite;
          flex-shrink: 0;
        }

        @keyframes ptt-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        .ptt-rec-text {
          flex: 1;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .ptt-rec-hint {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Processing Indicator */
        .ptt-processing-indicator {
          position: fixed;
          bottom: 220px;
          left: 16px;
          right: 84px;
          padding: 14px 16px;
          background: linear-gradient(180deg, 
            rgba(15, 20, 30, 0.92) 0%, 
            rgba(10, 15, 22, 0.95) 100%
          );
          backdrop-filter: blur(calc(16px - (var(--reduced-effects) * 8px)));
          -webkit-backdrop-filter: blur(calc(16px - (var(--reduced-effects) * 8px)));
          border: 1px solid rgba(34, 211, 238, 0.3);
          border-radius: 16px;
          z-index: 48;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          gap: 10px;
          color: #22d3ee;
          font-size: 14px;
          font-weight: 500;
        }

        /* Modal Overlay - Luxury Dark */
        .ptt-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 8, 6, 0.92);
          backdrop-filter: blur(calc(12px - (var(--reduced-effects) * 6px)));
          -webkit-backdrop-filter: blur(calc(12px - (var(--reduced-effects) * 6px)));
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

        /* Modal Glass Card - Luxury Infotainment */
        .ptt-modal-glass {
          width: 100%;
          max-width: 360px;
          background: linear-gradient(180deg, 
            rgba(25, 20, 15, 0.95) 0%, 
            rgba(15, 12, 8, 0.98) 100%
          );
          backdrop-filter: blur(calc(24px - (var(--reduced-effects) * 12px))) saturate(calc(180% - (var(--reduced-effects) * 40%)));
          -webkit-backdrop-filter: blur(calc(24px - (var(--reduced-effects) * 12px))) saturate(calc(180% - (var(--reduced-effects) * 40%)));
          border-radius: 24px;
          border: 1px solid rgba(147, 51, 234, 0.2);
          box-shadow: 
            0 25px 50px rgba(0, 0, 0, 0.5),
            0 0 60px rgba(147, 51, 234, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
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
          border-bottom: 1px solid rgba(147, 51, 234, 0.12);
          background: linear-gradient(180deg, rgba(147, 51, 234, 0.06) 0%, transparent 100%);
        }

        .ptt-modal-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(147, 51, 234, 0.15);
          border: 1px solid rgba(147, 51, 234, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
        }

        .ptt-modal-header h3 {
          flex: 1;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 16px;
          font-weight: 400;
          letter-spacing: 0.08em;
          color: #a78bfa;
          margin: 0;
          text-shadow: 0 0 12px rgba(147, 51, 234, 0.4);
        }

        .ptt-modal-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 200, 150, 0.5);
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

        .ptt-permission-hint {
          font-size: 12px !important;
          color: rgba(255, 255, 255, 0.6) !important;
          background: rgba(0, 0, 0, 0.2);
          padding: 10px;
          border-radius: 8px;
          margin-top: 8px;
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

        .ptt-speak-btn:hover:not(:disabled) {
          background: rgba(139, 92, 246, 0.2);
        }

        .ptt-speak-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .ptt-speak-btn.speaking {
          background: rgba(34, 197, 94, 0.15);
          border-color: rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }

        .ptt-speak-btn:disabled {
          cursor: not-allowed;
          opacity: 0.9;
        }
      `}</style>
    </>
  );
};

export default VoiceTranslator;
