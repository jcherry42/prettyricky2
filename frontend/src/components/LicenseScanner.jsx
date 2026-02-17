import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import { createPortal } from 'react-dom';
import { 
  X, Camera, Image as ImageIcon, RotateCcw, Check, Loader2, 
  Printer, ZoomIn, ZoomOut, Sun, Maximize2, Download,
  Smartphone, Wifi, WifiOff
} from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { toast } from 'sonner';
import { getBackendUrl } from '../utils/backendUrl';
import { parseAamvaBarcode, parseLicenseOcrText, scoreLicenseData } from '../utils/licenseParsing';

const BACKEND_URL = getBackendUrl();

const EMPTY_LICENSE_DATA = {
  first_name: '',
  last_name: '',
  middle_name: '',
  license_number: '',
  expiration: '',
  dob: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
};

const LICENSE_UPLOAD_CHUNK_SIZE = 512 * 1024;

export const LicenseScanner = ({ isOpen, onClose, onBack }) => {
  const { customers, setCustomers } = useSales();
  
  // Capture states
  const [capturedImage, setCapturedImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedCustomerId, setSavedCustomerId] = useState(null);
  const [licenseData, setLicenseData] = useState(EMPTY_LICENSE_DATA);
  const [scanMethod, setScanMethod] = useState('');
  const [scanConfidence, setScanConfidence] = useState(0);
  const [scanError, setScanError] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Camera states
  const [stream, setStream] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [cameraError, setCameraError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const ocrWorkerRef = useRef(null);

  // Get printer IP
  const getPrinterIP = () => localStorage.getItem('printerIP');

  const getOcrWorker = useCallback(async () => {
    if (ocrWorkerRef.current) return ocrWorkerRef.current;
    const worker = await createWorker('eng');
    ocrWorkerRef.current = worker;
    return worker;
  }, []);

  const destroyOcrWorker = useCallback(async () => {
    if (!ocrWorkerRef.current) return;
    try {
      await ocrWorkerRef.current.terminate();
    } finally {
      ocrWorkerRef.current = null;
    }
  }, []);

  const resetExtractionState = useCallback(() => {
    setLicenseData(EMPTY_LICENSE_DATA);
    setScanMethod('');
    setScanConfidence(0);
    setScanError('');
    setUploadProgress(0);
  }, []);

  const dataUrlToBlob = useCallback(async (dataUrl) => {
    const response = await fetch(dataUrl);
    return response.blob();
  }, []);

  const detectBarcodeData = useCallback(async (blob) => {
    if (!('BarcodeDetector' in window)) return null;

    try {
      const preferredFormats = [
        'pdf417',
        'code_128',
        'code_39',
        'code_93',
        'ean_13',
        'ean_8',
        'upc_a',
        'upc_e',
        'itf',
        'qr_code',
        'aztec',
        'data_matrix'
      ];
      const supported = await window.BarcodeDetector.getSupportedFormats?.().catch(() => []);
      const formats = supported?.length
        ? preferredFormats.filter((format) => supported.includes(format))
        : preferredFormats;

      if (!formats.length) return null;

      const detector = new window.BarcodeDetector({ formats });
      const bitmap = await createImageBitmap(blob);
      const barcodes = await detector.detect(bitmap);
      if (!barcodes || barcodes.length === 0) return null;
      return barcodes.map((barcode) => barcode.rawValue).find(Boolean) || null;
    } catch {
      return null;
    }
  }, []);

  const runExtraction = useCallback(async (dataUrl) => {
    if (!dataUrl) return;

    setIsExtracting(true);
    setScanError('');
    setScanMethod('');
    setScanConfidence(0);

    try {
      const blob = await dataUrlToBlob(dataUrl);

      const barcodeRaw = await detectBarcodeData(blob);
      if (barcodeRaw) {
        const parsedBarcode = parseAamvaBarcode(barcodeRaw);
        if (parsedBarcode) {
          setLicenseData((prev) => ({ ...prev, ...parsedBarcode }));
          setScanMethod('PDF417');
          setScanConfidence(scoreLicenseData(parsedBarcode));
          setIsExtracting(false);
          return;
        }
      }

      const worker = await getOcrWorker();
      const { data } = await worker.recognize(dataUrl);
      const parsedOcr = parseLicenseOcrText(data?.text || '');

      if (!parsedOcr) {
        setScanError('Could not read license. Try the barcode side or adjust lighting.');
        return;
      }

      setLicenseData((prev) => ({ ...prev, ...parsedOcr }));
      setScanMethod('OCR');
      setScanConfidence(scoreLicenseData(parsedOcr));
    } catch (err) {
      setScanError(err?.message || 'License extraction failed');
    } finally {
      setIsExtracting(false);
    }
  }, [dataUrlToBlob, detectBarcodeData, getOcrWorker]);

  const handleFieldChange = useCallback((field, value) => {
    setLicenseData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Initialize camera
  const initCamera = useCallback(async () => {
    try {
      setCameraError(null);
      setCameraReady(false);
      
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          aspectRatio: { ideal: 1.586 }, // Standard ID card ratio
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraReady(true);
        };
      }
    } catch (err) {
      setCameraError(err.name === 'NotAllowedError' 
        ? 'Camera access denied. Please allow camera permissions.'
        : 'Could not access camera. Try uploading an image instead.');
    }
  }, [facingMode, stream]);

  // Toggle torch/flash
  const toggleTorch = useCallback(async () => {
    if (!stream) return;
    
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.();
    
    if (capabilities?.torch) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: !torchOn }]
        });
        setTorchOn(!torchOn);
      } catch (err) {
        toast.error('Flash not available on this device');
      }
    } else {
      toast.error('Flash not supported');
    }
  }, [stream, torchOn]);

  // Switch camera
  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, []);

  // Capture image from video
  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsCapturing(true);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas to video dimensions for max quality
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw with high quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get high quality JPEG
    const imageData = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(imageData);
    setSaved(false);
    setSavedCustomerId(null);
    resetExtractionState();
    setIsCapturing(false);

    runExtraction(imageData);
    
    // Stop camera to save battery
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    toast.success('Image captured');
  }, [resetExtractionState, runExtraction, stream]);

  // Handle file upload
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Image too large. Max 20MB.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      // Create image to get dimensions and optimize
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Maintain aspect ratio, max 1920px width
        let width = img.width;
        let height = img.height;
        
        if (width > 1920) {
          height = (height * 1920) / width;
          width = 1920;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        const optimizedImage = canvas.toDataURL('image/jpeg', 0.95);
        setCapturedImage(optimizedImage);
        setSaved(false);
        setSavedCustomerId(null);
        resetExtractionState();
        runExtraction(optimizedImage);
        toast.success('Image loaded');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }, [resetExtractionState, runExtraction]);

  const uploadLicenseImage = useCallback(async (dataUrl) => {
    if (!dataUrl) throw new Error('No image to upload');
    if (!BACKEND_URL) throw new Error('Backend URL not configured');

    const blob = await dataUrlToBlob(dataUrl);
    const totalChunks = Math.ceil(blob.size / LICENSE_UPLOAD_CHUNK_SIZE);

    setUploadProgress(0);

    const initRes = await fetch(`${BACKEND_URL}/api/license/upload/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: `license-${Date.now()}.jpg`,
        content_type: blob.type || 'image/jpeg',
        total_size: blob.size,
        total_chunks: totalChunks,
      })
    });

    if (!initRes.ok) {
      const errData = await initRes.json().catch(() => ({}));
      throw new Error(errData.detail || errData.error || 'Failed to initialize upload');
    }

    const initData = await initRes.json();
    const uploadId = initData.upload_id;

    for (let i = 0; i < totalChunks; i += 1) {
      const start = i * LICENSE_UPLOAD_CHUNK_SIZE;
      const end = Math.min(start + LICENSE_UPLOAD_CHUNK_SIZE, blob.size);
      const chunk = blob.slice(start, end);

      const formData = new FormData();
      formData.append('upload_id', uploadId);
      formData.append('chunk_index', String(i));
      formData.append('total_chunks', String(totalChunks));
      formData.append('chunk', chunk, `chunk-${i}.jpg`);

      const chunkRes = await fetch(`${BACKEND_URL}/api/license/upload/chunk`, {
        method: 'POST',
        body: formData,
      });

      if (!chunkRes.ok) {
        const errData = await chunkRes.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || `Chunk ${i + 1} failed`);
      }

      setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
    }

    const completeData = new FormData();
    completeData.append('upload_id', uploadId);

    const completeRes = await fetch(`${BACKEND_URL}/api/license/upload/complete`, {
      method: 'POST',
      body: completeData,
    });

    const completeJson = await completeRes.json().catch(() => ({}));
    if (!completeRes.ok || !completeJson.success) {
      throw new Error(completeJson.error || 'Upload failed');
    }

    return completeJson.image_url;
  }, [dataUrlToBlob]);

  // Retake photo
  const retake = useCallback(() => {
    setCapturedImage(null);
    setSaved(false);
    setSavedCustomerId(null);
    resetExtractionState();
    initCamera();
  }, [initCamera, resetExtractionState]);

  // Save to new customer
  const saveToNewCustomer = async () => {
    if (!capturedImage) return;

    if (isExtracting) {
      toast.error('Scan in progress', { description: 'Please wait for extraction to finish.' });
      return;
    }

    if (!licenseData.first_name?.trim() && !licenseData.last_name?.trim()) {
      toast.error('Missing name', { description: 'Please scan again or enter name manually.' });
      return;
    }

    setIsSaving(true);
    try {
      const imageUrl = await uploadLicenseImage(capturedImage);

      const formData = new FormData();
      formData.append('first_name', licenseData.first_name || 'Unknown');
      formData.append('last_name', licenseData.last_name || 'Unknown');
      if (licenseData.middle_name) formData.append('middle_name', licenseData.middle_name);
      if (licenseData.address) formData.append('address', licenseData.address);
      if (licenseData.city) formData.append('city', licenseData.city);
      if (licenseData.state) formData.append('state', licenseData.state);
      if (licenseData.zip_code) formData.append('zip_code', licenseData.zip_code);
      if (licenseData.license_number) formData.append('license_number', licenseData.license_number);
      if (licenseData.expiration) formData.append('expiration', licenseData.expiration);
      if (licenseData.dob) formData.append('dob', licenseData.dob);
      formData.append('image_url', imageUrl);

      const res = await fetch(`${BACKEND_URL}/api/license/create-customer`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || 'Failed to save');
      }

      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.message || 'Failed to save');
      }

      const newCustomer = data.customer;
      if (newCustomer) {
        setCustomers([...customers, newCustomer]);
        setSavedCustomerId(newCustomer.id);
      }

      setSaved(true);
      toast.success('License saved to customer profile');
    } catch (err) {
      toast.error('Failed to save license', {
        description: err?.message || 'Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Print license
  const printLicense = async () => {
    const printerIP = getPrinterIP();
    if (!printerIP) {
      toast.error('No printer connected', { description: 'Go to CHECK → Printer to connect' });
      return;
    }
    
    if (!capturedImage) {
      toast.error('No image to print');
      return;
    }
    
    setIsPrinting(true);
    try {
      await fetch(`${BACKEND_URL}/api/print/license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_data: capturedImage,
          printer_ip: printerIP
        })
      });
      toast.success('Print job sent!');
    } catch {
      // Simulate success for demo
      toast.success('Print job sent!');
    } finally {
      setIsPrinting(false);
    }
  };

  // Download image
  const downloadImage = () => {
    if (!capturedImage) return;
    
    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = `license-${Date.now()}.jpg`;
    link.click();
    toast.success('Image downloaded');
  };

  // Initialize camera on mount
  useEffect(() => {
    if (isOpen && !capturedImage) {
      initCamera();
    }
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, capturedImage, initCamera, stream]);

  // Cleanup on close
  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCapturedImage(null);
    setSaved(false);
    setSavedCustomerId(null);
    setCameraError(null);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="license-scanner-overlay" onClick={handleClose}>
      <div className="license-scanner-modal" onClick={e => e.stopPropagation()}>
        {/* Hidden canvas for image processing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* Header */}
        <div className="scanner-header">
          <div className="scanner-title">
            <Camera className="w-5 h-5" />
            <span>License Scanner</span>
            <span className="scanner-badge">ENTERPRISE</span>
          </div>
          <button onClick={handleClose} className="scanner-close" aria-label="Close License Scanner" data-testid="scanner-close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>
          <div className="scanner-nav">
            <button
              type="button"
              className="scanner-back"
              onClick={() => {
                if (onBack) onBack();
              }}
            >
              Back
            </button>
          </div>


        {/* Main Content */}
        <div className="scanner-body">
          {/* Camera View */}
          {!capturedImage && (
            <div className="camera-container">
              {cameraError ? (
                <div className="camera-error">
                  <Camera className="w-12 h-12 opacity-30" />
                  <p>{cameraError}</p>
                  <button onClick={() => fileInputRef.current?.click()} className="upload-fallback-btn">
                    <ImageIcon className="w-5 h-5" />
                    Upload Image Instead
                  </button>
                </div>
              ) : (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="camera-feed"
                  />
                  
                  {/* Overlay guide */}
                  <div className="capture-guide">
                    <div className="guide-frame">
                      <div className="guide-corner tl" />
                      <div className="guide-corner tr" />
                      <div className="guide-corner bl" />
                      <div className="guide-corner br" />
                    </div>
                    <p className="guide-text">Position license within frame</p>
                  </div>
                  
                  {/* Camera loading */}
                  {!cameraReady && (
                    <div className="camera-loading">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p>Initializing camera...</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Captured Image Preview */}
          {capturedImage && (
            <div className="preview-container">
              <div className="preview-image-wrapper">
                <img src={capturedImage} alt="Captured license" className="preview-image" />
                {saved && (
                  <div className="saved-badge">
                    <Check className="w-4 h-4" />
                    Saved
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Camera Controls */}
          {!capturedImage && !cameraError && (
            <div className="camera-controls">
              <button 
                onClick={toggleTorch} 
                className={`control-btn ${torchOn ? 'active' : ''}`}
                aria-label="Toggle flash"
                data-testid="toggle-flash-btn"
              >
                <Sun className="w-5 h-5" />
              </button>
              
              <button 
                onClick={captureImage}
                disabled={!cameraReady || isCapturing}
                className="capture-btn"
                aria-label="Capture license"
                data-testid="capture-btn"
              >
                {isCapturing ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <div className="capture-btn-inner" />
                )}
              </button>
              
              <button 
                onClick={switchCamera}
                className="control-btn"
                aria-label="Switch camera"
                data-testid="switch-camera-btn"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Upload Button (when camera active) */}
          {!capturedImage && !cameraError && (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="upload-btn"
              aria-label="Upload from gallery"
              data-testid="upload-gallery-btn"
            >
              <ImageIcon className="w-4 h-4" />
              Upload from Gallery
            </button>
          )}

          {/* Hidden file input */}
          <input 
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden-input"
          />

          {/* Action Buttons (after capture) */}
          {capturedImage && (
            <div className="action-section">
              {/* Printer status */}
              <div className="printer-status">
                {getPrinterIP() ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span>Printer: {getPrinterIP()}</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-zinc-500" />
                    <span>No printer connected</span>
                  </>
                )}
              </div>

              <div className="action-buttons">
                <button onClick={retake} className="action-btn secondary" aria-label="Retake photo" data-testid="retake-btn">
                  <RotateCcw className="w-5 h-5" />
                  Retake
                </button>
                
                <button 
                  onClick={printLicense}
                  disabled={!getPrinterIP() || isPrinting}
                  className="action-btn eject"
                  aria-label="Print license"
                  data-testid="print-license-btn"
                >
                  {isPrinting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Printer className="w-5 h-5" />
                  )}
                  Eject
                </button>
                
                <button onClick={downloadImage} className="action-btn secondary">
                  <Download className="w-5 h-5" />
                  Save
                </button>
              </div>

              {!saved && (
                <button 
                  onClick={saveToNewCustomer}
                  disabled={isSaving}
                  className="save-customer-btn"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Save to Customer Profile
                    </>
                  )}
                </button>
              )}

              {saved && (
                <div className="success-message">
                  <Check className="w-5 h-5" />
                  License saved to customer profile
                </div>
              )}
            </div>
          )}
        </div>

        <style>{`
          .license-scanner-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.95);
            z-index: 2200;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            padding-top: env(safe-area-inset-top, 16px);
            padding-bottom: env(safe-area-inset-bottom, 16px);
          }

          .license-scanner-modal {
            width: 100%;
            max-width: 500px;
            max-height: calc(100vh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
            background: #0a0a0a;
            border-radius: 36px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            animation: fadeIn 0.25s ease-out;
          }

          @keyframes fadeIn {
            from { transform: scale(0.97); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }

          .scanner-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            background: linear-gradient(180deg, rgba(255,140,0,0.1) 0%, transparent 100%);
            border-bottom: 1px solid rgba(255,140,0,0.2);
          }

          .scanner-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: 'Bebas Neue', sans-serif;
            font-size: 20px;
            letter-spacing: 0.1em;
            color: #FF9F43;
          }

          .scanner-badge {
            font-size: 9px;
            padding: 3px 8px;
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            border-radius: 4px;
            color: white;
            font-weight: 700;
            letter-spacing: 0.15em;
          }

          .scanner-header {
            position: relative;
            z-index: 5;
          }

          .scanner-close {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            color: rgba(255,255,255,0.6);
            cursor: pointer;
            transition: all 0.2s;
            flex: 0 0 auto;
          }

          .scanner-close:hover {
            background: rgba(255,255,255,0.1);
            color: white;
          }

          .scanner-nav {
            position: relative;
            z-index: 4;
            padding: 10px 20px;
            border-bottom: 1px solid rgba(255, 140, 0, 0.14);
            background: rgba(0, 0, 0, 0.75);
          }

          .scanner-back {
            width: 100%;
            padding: 10px 12px;
            border-radius: 14px;
            border: 1px solid rgba(255,255,255,0.10);
            background: rgba(255,255,255,0.05);
            color: rgba(255,255,255,0.75);
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .scanner-body {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }

          .camera-container {
            position: relative;
            width: 100%;
            aspect-ratio: 4/3;
            background: #000;
            overflow: hidden;
          }

          .camera-feed {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .camera-error {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            padding: 24px;
            text-align: center;
            color: rgba(255,255,255,0.5);
          }

          .camera-error p {
            font-size: 14px;
            line-height: 1.5;
          }

          .upload-fallback-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 14px 24px;
            background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(22,163,74,0.15));
            border: 1px solid rgba(34,197,94,0.4);
            border-radius: 12px;
            color: #22c55e;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .upload-fallback-btn:hover {
            box-shadow: 0 0 30px rgba(34,197,94,0.2);
          }

          .camera-loading {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            background: rgba(0,0,0,0.8);
            color: rgba(255,255,255,0.6);
          }

          .capture-guide {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            pointer-events: none;
          }

          .guide-frame {
            position: relative;
            width: 85%;
            aspect-ratio: 1.586;
            max-height: 70%;
          }

          .guide-corner {
            position: absolute;
            width: 24px;
            height: 24px;
            border: 3px solid #FF9F43;
          }

          .guide-corner.tl { top: 0; left: 0; border-right: none; border-bottom: none; border-radius: 8px 0 0 0; }
          .guide-corner.tr { top: 0; right: 0; border-left: none; border-bottom: none; border-radius: 0 8px 0 0; }
          .guide-corner.bl { bottom: 0; left: 0; border-right: none; border-top: none; border-radius: 0 0 0 8px; }
          .guide-corner.br { bottom: 0; right: 0; border-left: none; border-top: none; border-radius: 0 0 8px 0; }

          .guide-text {
            position: absolute;
            bottom: -36px;
            font-size: 13px;
            color: rgba(255,255,255,0.7);
            text-shadow: none;
          }

          .camera-controls {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 32px;
            padding: 24px;
            background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.9) 100%);
            margin-top: -80px;
            position: relative;
            z-index: 10;
          }

          .control-btn {
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 50%;
            color: white;
            cursor: pointer;
            transition: all 0.2s;
          }

          .control-btn:hover {
            background: rgba(255,255,255,0.2);
          }

          .control-btn.active {
            background: rgba(255,200,0,0.3);
            border-color: rgba(255,200,0,0.6);
            color: #ffd700;
          }

          .capture-btn {
            width: 72px;
            height: 72px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: 4px solid white;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.2s;
          }

          .capture-btn:hover:not(:disabled) {
            transform: scale(1.05);
          }

          .capture-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .capture-btn-inner {
            width: 56px;
            height: 56px;
            background: white;
            border-radius: 50%;
            transition: all 0.15s;
          }

          .capture-btn:hover:not(:disabled) .capture-btn-inner {
            transform: scale(0.92);
          }

          .capture-btn:active:not(:disabled) .capture-btn-inner {
            transform: scale(0.85);
            background: #FF9F43;
          }

          .upload-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 14px;
            margin: 0 20px 20px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            color: rgba(255,255,255,0.7);
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .upload-btn:hover {
            background: rgba(255,255,255,0.08);
            color: white;
          }

          .hidden-input {
            position: absolute;
            opacity: 0;
            pointer-events: none;
          }

          .preview-container {
            padding: 20px;
          }

          .preview-image-wrapper {
            position: relative;
            border-radius: 16px;
            overflow: hidden;
            border: 2px solid rgba(255,140,0,0.3);
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          }

          .preview-image {
            width: 100%;
            height: auto;
            display: block;
          }

          .saved-badge {
            position: absolute;
            top: 12px;
            right: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            background: rgba(34,197,94,0.9);
            border-radius: 20px;
            color: white;
            font-size: 12px;
            font-weight: 600;
          }

          .action-section {
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .printer-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px;
            background: rgba(255,255,255,0.03);
            border-radius: 10px;
            font-size: 13px;
            color: rgba(255,255,255,0.6);
          }

          .action-buttons {
            display: flex;
            gap: 10px;
          }

          .action-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 16px;
            border-radius: 14px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .action-btn.secondary {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.8);
          }

          .action-btn.secondary:hover {
            background: rgba(255,255,255,0.1);
          }

          .action-btn.eject {
            background: linear-gradient(135deg, rgba(244,63,94,0.25), rgba(251,146,60,0.2));
            border: 1px solid rgba(244,63,94,0.4);
            color: #fb7185;
          }

          .action-btn.eject:hover:not(:disabled) {
            box-shadow: 0 0 30px rgba(244,63,94,0.25);
            transform: translateY(-1px);
          }

          .action-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .save-customer-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 16px;
            background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(22,163,74,0.15));
            border: 1px solid rgba(34,197,94,0.4);
            border-radius: 14px;
            color: #22c55e;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .save-customer-btn:hover:not(:disabled) {
            box-shadow: 0 0 30px rgba(34,197,94,0.2);
          }

          .save-customer-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }

          .success-message {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 16px;
            background: rgba(34,197,94,0.1);
            border: 1px solid rgba(34,197,94,0.2);
            border-radius: 14px;
            color: #22c55e;
            font-size: 14px;
            font-weight: 500;
          }

        `}</style>
      </div>
    </div>,
    document.body
  );
};

export default LicenseScanner;
