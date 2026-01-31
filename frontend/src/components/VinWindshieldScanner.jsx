import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Camera, Image as ImageIcon, Loader2, RotateCcw, Zap } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { toast } from 'sonner';

// Strict VIN constraints
const VIN_REGEX = /[A-HJ-NPR-Z0-9]{17}/g;

// Lightweight, offline-first VIN OCR.
// NOTE: This is an MVP foundation for the “real scanner” (windshield plate). We'll iterate on:
// - preprocessing
// - ROI guidance
// - confidence scoring
// - batch capture
const VinWindshieldScanner = ({ isOpen, onClose, onVinDetected }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognized, setRecognized] = useState([]);

  const workerRef = useRef(null);

  const cleanupStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    setStream(null);
    setCameraReady(false);
  }, [stream]);

  const initCamera = useCallback(async () => {
    try {
      setCameraError(null);
      setCameraReady(false);

      cleanupStream();

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraReady(true);
        };
      }
    } catch (err) {
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera permissions.'
          : 'Could not access camera. You can upload an image instead.'
      );
    }
  }, [cleanupStream]);

  // Create Tesseract worker lazily.
  const getWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;

    const worker = await createWorker('eng');
    workerRef.current = worker;
    return worker;
  }, []);

  const destroyWorker = useCallback(async () => {
    if (!workerRef.current) return;
    try {
      await workerRef.current.terminate();
    } finally {
      workerRef.current = null;
    }
  }, []);

  const preprocessToVinROI = useCallback((inputCanvas) => {
    // ROI strategy (enterprise-minded but simple):
    // - VIN is typically lower-left through windshield.
    // - Crop to bottom-left quadrant (tunable).
    const src = inputCanvas;
    const w = src.width;
    const h = src.height;

    const cropX = 0;
    const cropY = Math.floor(h * 0.55);
    const cropW = Math.floor(w * 0.65);
    const cropH = h - cropY;

    const out = document.createElement('canvas');
    out.width = cropW;
    out.height = cropH;
    const ctx = out.getContext('2d');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw crop
    ctx.drawImage(src, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    // Basic contrast boost + grayscale (fast)
    const imgData = ctx.getImageData(0, 0, out.width, out.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      // Contrast (simple)
      const contrast = 1.25;
      const v = Math.max(0, Math.min(255, (gray - 128) * contrast + 128));

      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);

    return out;
  }, []);

  const extractVins = useCallback((text) => {
    const upper = (text || '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ');
    const matches = upper.match(VIN_REGEX) || [];
    // Deduplicate while preserving order
    const seen = new Set();
    const uniq = [];
    for (const m of matches) {
      if (!seen.has(m)) {
        seen.add(m);
        uniq.push(m);
      }
    }
    return uniq;
  }, []);

  const runOcr = useCallback(
    async (dataUrl) => {
      setIsProcessing(true);
      setRecognized([]);
      try {
        const img = new Image();
        const imageLoaded = new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        img.src = dataUrl;
        await imageLoaded;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const roiCanvas = preprocessToVinROI(canvas);

        const worker = await getWorker();
        const { data } = await worker.recognize(roiCanvas);

        const vins = extractVins(data?.text || '');

        setRecognized(vins);

        if (vins.length === 0) {
          toast.error('No VIN detected', {
            description: 'Try moving closer, reducing glare, and keeping the VIN plate centered in the guide box.',
          });
        } else {
          toast.success('VIN detected', { description: vins[0] });
        }
      } catch (err) {
        toast.error('VIN recognition failed', { description: err?.message || 'Unknown error' });
      } finally {
        setIsProcessing(false);
      }
    },
    [extractVins, getWorker, preprocessToVinROI]
  );

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);

    // Stop camera to save battery while processing.
    cleanupStream();

    runOcr(dataUrl);
  }, [cleanupStream, runOcr]);

  const handleFileUpload = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        setCapturedImage(dataUrl);
        runOcr(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [runOcr]
  );

  const reset = useCallback(() => {
    setCapturedImage(null);
    setRecognized([]);
    setIsProcessing(false);
    initCamera();
  }, [initCamera]);

  useEffect(() => {
    if (!isOpen) return;
    initCamera();

    return () => {
      cleanupStream();
      destroyWorker();
    };
  }, [cleanupStream, destroyWorker, initCamera, isOpen]);

  const primaryVin = recognized[0] || null;

  const canUseDetected = useMemo(() => {
    return Boolean(primaryVin) && !isProcessing;
  }, [isProcessing, primaryVin]);

  if (!isOpen) return null;

  return (
    <div className="vinws-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="vinws-modal" onClick={(e) => e.stopPropagation()}>
        <div className="vinws-header">
          <div className="vinws-title">
            <Camera className="w-5 h-5" />
            <span>Windshield VIN Scanner</span>
            <span className="vinws-badge">OFFLINE OCR</span>
          </div>
          <button className="vinws-close" onClick={onClose} aria-label="Close VIN scanner">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="vinws-body">
          {!capturedImage ? (
            <div className="vinws-camera">
              <video ref={videoRef} className="vinws-video" playsInline muted />
              <div className="vinws-guide">
                <div className="vinws-guide-box" />
                <div className="vinws-guide-text">Aim at the VIN plate (bottom-left of windshield). Avoid glare.</div>
              </div>

              {cameraError && (
                <div className="vinws-error">
                  <p>{cameraError}</p>
                </div>
              )}

              {!cameraError && !cameraReady && (
                <div className="vinws-loading">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Starting camera</span>
                </div>
              )}

              <div className="vinws-controls">
                <button
                  className="vinws-control"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload VIN photo"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                <button
                  className="vinws-capture"
                  onClick={captureFrame}
                  disabled={!cameraReady}
                  aria-label="Capture VIN frame"
                >
                  <div className="vinws-capture-inner" />
                </button>

                <button className="vinws-control" onClick={initCamera} aria-label="Restart camera">
                  <RotateCcw className="w-5 h-5" />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="vinws-hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          ) : (
            <div className="vinws-result">
              <div className="vinws-preview">
                <img src={capturedImage} alt="Captured VIN" className="vinws-preview-img" />
              </div>

              <div className="vinws-recognized">
                <div className="vinws-recognized-title">
                  <Zap className="w-4 h-4" />
                  Detected VINs
                </div>

                {isProcessing ? (
                  <div className="vinws-processing">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Recognizing</span>
                  </div>
                ) : recognized.length === 0 ? (
                  <div className="vinws-empty">No VIN detected. Try again.</div>
                ) : (
                  <div className="vinws-vins">
                    {recognized.map((v) => (
                      <button
                        key={v}
                        className={`vinws-vin ${v === primaryVin ? 'primary' : ''}`}
                        onClick={() => {
                          onVinDetected?.(v);
                          onClose?.();
                        }}
                      >
                        <span className="vinws-vin-text">{v}</span>
                        <span className="vinws-vin-action">Use</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="vinws-actions">
                  <button className="vinws-secondary" onClick={reset}>
                    Retake
                  </button>
                  <button
                    className="vinws-primary"
                    disabled={!canUseDetected}
                    onClick={() => {
                      if (!primaryVin) return;
                      onVinDetected?.(primaryVin);
                      onClose?.();
                    }}
                  >
                    Use VIN
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="vinws-hidden" />

        <style>{`
          .vinws-overlay {
            position: fixed;
            inset: 0;
            z-index: 140;
            background: rgba(0,0,0,0.86);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            padding-top: env(safe-area-inset-top, 16px);
            padding-bottom: env(safe-area-inset-bottom, 16px);
          }

          .vinws-modal {
            width: 100%;
            max-width: 560px;
            max-height: 85dvh;
            border-radius: 26px;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.12);
            background:
              radial-gradient(ellipse 160% 120% at 15% 10%, rgba(0, 170, 255, 0.10) 0%, transparent 55%),
              linear-gradient(165deg, #141312 0%, #0b0a0a 60%, #121110 100%);
            box-shadow: 0 30px 80px rgba(0,0,0,0.55);
            display: flex;
            flex-direction: column;
          }

          .vinws-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 14px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            background: rgba(0,0,0,0.25);
            backdrop-filter: blur(10px);
          }

          .vinws-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 850;
            letter-spacing: 0.4px;
            color: rgba(200, 240, 255, 0.92);
            flex-wrap: wrap;
          }

          .vinws-badge {
            font-size: 10px;
            padding: 3px 8px;
            border-radius: 999px;
            background: rgba(0, 170, 255, 0.14);
            border: 1px solid rgba(0, 170, 255, 0.22);
            color: rgba(190, 240, 255, 0.92);
            letter-spacing: 0.12em;
          }

          .vinws-close {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.10);
            background: rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .vinws-body {
            padding: 14px;
            overflow: auto;
          }

          .vinws-camera {
            position: relative;
            width: 100%;
            aspect-ratio: 4/3;
            background: #000;
            border-radius: 18px;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.08);
          }

          .vinws-video {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .vinws-guide {
            position: absolute;
            inset: 0;
            pointer-events: none;
            display: flex;
            align-items: flex-end;
            justify-content: flex-start;
            padding: 16px;
          }

          .vinws-guide-box {
            width: 56%;
            height: 26%;
            border-radius: 14px;
            border: 2px solid rgba(0, 170, 255, 0.55);
            box-shadow: 0 0 22px rgba(0, 170, 255, 0.25);
            backdrop-filter: blur(1px);
          }

          .vinws-guide-text {
            position: absolute;
            left: 16px;
            right: 16px;
            bottom: 12px;
            font-size: 12px;
            color: rgba(255,255,255,0.65);
            text-shadow: none;
          }

          .vinws-loading {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.70);
            color: rgba(255,255,255,0.72);
          }

          .vinws-error {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            color: rgba(255,255,255,0.70);
            background: rgba(0,0,0,0.70);
            text-align: center;
          }

          .vinws-controls {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 28px;
            padding: 18px;
            background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 100%);
          }

          .vinws-control {
            width: 46px;
            height: 46px;
            border-radius: 50%;
            border: 1px solid rgba(255,255,255,0.20);
            background: rgba(255,255,255,0.10);
            color: rgba(255,255,255,0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .vinws-capture {
            width: 74px;
            height: 74px;
            border-radius: 50%;
            background: transparent;
            border: 4px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .vinws-capture:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .vinws-capture-inner {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: white;
          }

          .vinws-result {
            display: grid;
            gap: 14px;
          }

          .vinws-preview {
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.10);
            background: rgba(255,255,255,0.03);
          }

          .vinws-preview-img {
            width: 100%;
            display: block;
          }

          .vinws-recognized {
            padding: 12px;
            border-radius: 16px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
          }

          .vinws-recognized-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 850;
            font-size: 13px;
            color: rgba(255,255,255,0.92);
            margin-bottom: 10px;
          }

          .vinws-processing {
            display: flex;
            align-items: center;
            gap: 8px;
            color: rgba(255,255,255,0.72);
            font-size: 12px;
          }

          .vinws-empty {
            color: rgba(255,255,255,0.62);
            font-size: 12px;
            padding: 8px 0;
          }

          .vinws-vins {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .vinws-vin {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 10px 12px;
            border-radius: 14px;
            border: 1px solid rgba(255,255,255,0.10);
            background: rgba(0,0,0,0.25);
            color: rgba(255,255,255,0.92);
            cursor: pointer;
          }

          .vinws-vin.primary {
            border-color: rgba(0, 170, 255, 0.28);
            box-shadow: 0 0 0 1px rgba(0, 170, 255, 0.10);
          }

          .vinws-vin-text {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 800;
            letter-spacing: 0.08em;
            font-size: 12px;
          }

          .vinws-vin-action {
            font-size: 11px;
            font-weight: 800;
            padding: 4px 8px;
            border-radius: 999px;
            background: rgba(0, 170, 255, 0.14);
            border: 1px solid rgba(0, 170, 255, 0.22);
            color: rgba(190, 240, 255, 0.92);
          }

          .vinws-actions {
            display: flex;
            gap: 10px;
            margin-top: 12px;
          }

          .vinws-secondary {
            flex: 1;
            padding: 12px 12px;
            border-radius: 14px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.85);
            font-weight: 800;
            font-size: 13px;
          }

          .vinws-primary {
            flex: 1;
            padding: 12px 12px;
            border-radius: 14px;
            border: 1px solid rgba(0, 170, 255, 0.28);
            background: rgba(0, 170, 255, 0.12);
            color: rgba(200, 240, 255, 0.92);
            font-weight: 900;
            font-size: 13px;
          }

          .vinws-primary:disabled {
            opacity: 0.55;
          }

          .vinws-hidden {
            position: absolute;
            width: 1px;
            height: 1px;
            opacity: 0;
            pointer-events: none;
          }
        `}</style>
      </div>
    </div>
  );
};

export default VinWindshieldScanner;
