import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Loader, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

/**
 * VisionExtractor - Elite Image-to-Data Component
 * Powered by GPT-5.1 Vision Model
 * Extracts customer data from screenshots and images
 */
const VisionExtractor = ({ onDataExtracted, onClose }) => {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const pasteAreaRef = useRef(null);

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Process image file
  const processImageFile = async (file) => {
    try {
      // Validate format
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid format. Please use PNG, JPEG, or WEBP.');
        return;
      }

      // Validate size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image too large. Maximum size is 10MB.');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);

      // Convert to base64 for API
      const base64Reader = new FileReader();
      base64Reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1]; // Remove data:image/...;base64,
        setImage(base64);
        toast.success('Image loaded! Click "Extract Data" to analyze.');
      };
      base64Reader.readAsDataURL(file);

    } catch {
      toast.error('Failed to process image');
    }
  };

  // Handle paste
  const handlePaste = async (e) => {
    e.preventDefault();
    const items = e.clipboardData?.items;
    
    if (!items) return;

    for (let item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          processImageFile(file);
        }
        break;
      }
    }
  };

  // Extract data from image
  const extractData = async () => {
    if (!image) {
      toast.error('Please upload or paste an image first');
      return;
    }

    setExtracting(true);
    setResult(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/vision/extract-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: image,
          additional_context: null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Extraction failed');
      }

      if (data.success && data.data) {
        setResult(data);
        toast.success('Data extracted successfully!');
      } else {
        throw new Error('No data could be extracted from the image');
      }

    } catch (error) {
      toast.error(error.message || 'Failed to extract data');
      setResult({ success: false, error: error.message });
    } finally {
      setExtracting(false);
    }
  };

  // Use extracted data
  const useExtractedData = () => {
    if (result?.data) {
      onDataExtracted(result.data);
      toast.success('Data ready to save!');
    }
  };

  return (
    <div className="vision-extractor">
      {/* Header */}
      <div className="ve-header">
        <div>
          <h3 className="ve-title">
            <ImageIcon className="w-6 h-6" />
            Vision Extraction
          </h3>
          <p className="ve-subtitle">Powered by GPT-5.1 Elite Vision Model</p>
        </div>
        <button onClick={onClose} className="ve-close-btn" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Upload Area */}
      {!imagePreview && (
        <div className="ve-upload-area">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          {/* Paste Area */}
          <div
            ref={pasteAreaRef}
            className="ve-paste-zone"
            onPaste={handlePaste}
            tabIndex={0}
          >
            <Camera className="w-16 h-16 opacity-40 mb-4" />
            <h4 className="ve-paste-title">Drop, Upload, or Paste Image</h4>
            <p className="ve-paste-desc">
              Screenshots, photos, scanned documents
            </p>
            <p className="ve-paste-hint">
              Press Ctrl+V to paste from clipboard
            </p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="ve-upload-btn"
          >
            <Upload className="w-5 h-5" />
            Choose File
          </button>
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="ve-preview-area">
          <img src={imagePreview} alt="Preview" className="ve-preview-img" />
          <button
            onClick={() => {
              setImagePreview(null);
              setImage(null);
              setResult(null);
            }}
            className="ve-remove-btn"
          >
            <X className="w-4 h-4" /> Remove
          </button>
        </div>
      )}

      {/* Extract Button */}
      {image && !result && (
        <button
          onClick={extractData}
          disabled={extracting}
          className="ve-extract-btn gold-btn"
        >
          {extracting ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Analyzing Image...
            </>
          ) : (
            <>
              <Camera className="w-5 h-5" />
              Extract Data
            </>
          )}
        </button>
      )}

      {/* Results */}
      {result && (
        <div className={`ve-result ${result.success ? 'success' : 'error'}`}>
          {result.success ? (
            <>
              <div className="ve-result-header">
                <CheckCircle className="w-6 h-6 text-green-500" />
                <h4>Data Extracted Successfully!</h4>
              </div>
              <div className="ve-result-data">
                {Object.entries(result.data).map(([key, value]) => {
                  if (!value) return null;
                  return (
                    <div key={key} className="ve-data-row">
                      <span className="ve-data-label">{key}:</span>
                      <span className="ve-data-value">{value}</span>
                    </div>
                  );
                })}
              </div>
              <button onClick={useExtractedData} className="ve-use-btn gold-btn">
                Use This Data
              </button>
            </>
          ) : (
            <>
              <div className="ve-result-header">
                <AlertCircle className="w-6 h-6 text-red-500" />
                <h4>Extraction Failed</h4>
              </div>
              <p className="ve-error-text">{result.error}</p>
            </>
          )}
        </div>
      )}

      <style>{`
        .vision-extractor {
          padding: 24px;
          max-width: 600px;
        }

        .ve-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .ve-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .ve-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .ve-close-btn {
          padding: 8px;
          border-radius: 8px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
        }

        .ve-close-btn:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        html.dark .ve-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .ve-upload-area {
          text-align: center;
          margin-bottom: 24px;
        }

        .ve-paste-zone {
          border: 3px dashed rgba(0, 150, 255, 0.3);
          border-radius: 16px;
          padding: 48px 24px;
          margin-bottom: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ve-paste-zone:hover,
        .ve-paste-zone:focus {
          border-color: rgba(0, 150, 255, 0.6);
          background: rgba(0, 150, 255, 0.05);
        }

        .ve-paste-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .ve-paste-desc {
          font-size: 14px;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }

        .ve-paste-hint {
          font-size: 12px;
          color: var(--text-tertiary);
          font-style: italic;
        }

        .ve-upload-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: 12px;
          background: linear-gradient(135deg, #00D9FF 0%, #0080FF 100%);
          color: white;
          border: none;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ve-upload-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 150, 255, 0.4);
        }

        .ve-preview-area {
          position: relative;
          margin-bottom: 24px;
          border-radius: 16px;
          overflow: hidden;
        }

        .ve-preview-img {
          width: 100%;
          height: auto;
          max-height: 400px;
          object-fit: contain;
          background: rgba(0, 0, 0, 0.05);
        }

        html.dark .ve-preview-img {
          background: rgba(255, 255, 255, 0.05);
        }

        .ve-remove-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          background: rgba(255, 0, 0, 0.9);
          color: white;
          border: none;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ve-remove-btn:hover {
          background: rgba(255, 0, 0, 1);
        }

        .ve-extract-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 16px;
          font-size: 16px;
        }

        .ve-result {
          padding: 24px;
          border-radius: 16px;
          margin-top: 24px;
        }

        .ve-result.success {
          background: rgba(0, 255, 136, 0.1);
          border: 2px solid rgba(0, 255, 136, 0.3);
        }

        .ve-result.error {
          background: rgba(255, 0, 0, 0.1);
          border: 2px solid rgba(255, 0, 0, 0.3);
        }

        .ve-result-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .ve-result-header h4 {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
        }

        .ve-result-data {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 20px;
        }

        .ve-data-row {
          display: flex;
          gap: 12px;
          padding: 8px;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 8px;
        }

        html.dark .ve-data-row {
          background: rgba(0, 0, 0, 0.3);
        }

        .ve-data-label {
          font-weight: 600;
          min-width: 140px;
          color: var(--text-secondary);
        }

        .ve-data-value {
          flex: 1;
          color: var(--text-primary);
        }

        .ve-use-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px;
        }

        .ve-error-text {
          color: var(--text-secondary);
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
};

export default VisionExtractor;
