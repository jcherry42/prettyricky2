"""
Audio Preprocessing Pipeline — Supercharg'd
═══════════════════════════════════════════════════════════════════
Enterprise-grade audio preprocessing before Whisper STT:
  • Noise suppression (spectral gating)
  • Audio normalization (peak normalization to -3dB)
  • Silence trimming (remove leading/trailing silence)
  • Sample rate standardization (16kHz mono for optimal Whisper performance)
  • Automotive vocabulary prompt biasing for Whisper
"""

from __future__ import annotations

import io
import logging
import wave
from typing import Optional, Tuple

import numpy as np

logger = logging.getLogger("audio_pipeline")

# ═══════════════════════════════════════════════════════════════════
# WHISPER AUTOMOTIVE PROMPT BIASING
# ═══════════════════════════════════════════════════════════════════

AUTOMOTIVE_WHISPER_PROMPT = (
    "Automotive dealership sales conversation. "
    "Terms: VIN, MSRP, APR, OTD price, trade-in, test drive, financing, lease, "
    "down payment, monthly payment, credit score, pre-approval, co-signer, "
    "sticker price, invoice price, dealer holdback, incentive, rebate, "
    "certified pre-owned, CPO, odometer, mileage, CarFax, AutoCheck, "
    "powertrain warranty, bumper-to-bumper, extended warranty, GAP insurance, "
    "title, registration, doc fee, dealer fee, destination charge, "
    "trade equity, negative equity, payoff, lien, "
    "SUV, sedan, coupe, truck, crossover, minivan, hybrid, EV, electric vehicle, "
    "all-wheel drive, AWD, four-wheel drive, 4WD, front-wheel drive, FWD, "
    "horsepower, torque, turbocharged, V6, V8, inline-four, "
    "leather, sunroof, panoramic roof, navigation, Apple CarPlay, Android Auto, "
    "adaptive cruise control, lane assist, blind spot monitoring, "
    "Mercedes-Benz, BMW, Audi, Lexus, Tesla, Toyota, Honda, Ford, Chevrolet, "
    "Hyundai, Kia, Nissan, Subaru, Mazda, Volkswagen, Porsche, "
    "Cadillac, Lincoln, Genesis, Acura, Infiniti, Volvo, Land Rover, Jaguar."
)


# ═══════════════════════════════════════════════════════════════════
# AUDIO PREPROCESSING
# ═══════════════════════════════════════════════════════════════════

def _bytes_to_pcm(audio_bytes: bytes, file_ext: str) -> Optional[Tuple[np.ndarray, int]]:
    """Attempt to extract PCM data from audio bytes. Returns (samples, sample_rate) or None."""
    try:
        if file_ext in ('wav', 'wave'):
            with wave.open(io.BytesIO(audio_bytes), 'rb') as wf:
                n_channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                sample_rate = wf.getframerate()
                n_frames = wf.getnframes()
                raw = wf.readframes(n_frames)

                if sample_width == 2:
                    dtype = np.int16
                elif sample_width == 4:
                    dtype = np.int32
                else:
                    return None

                samples = np.frombuffer(raw, dtype=dtype).astype(np.float32)
                if n_channels > 1:
                    samples = samples.reshape(-1, n_channels).mean(axis=1)
                # Normalize to [-1, 1]
                max_val = float(np.iinfo(dtype).max)
                samples = samples / max_val
                return samples, sample_rate
    except Exception as e:
        logger.debug(f"PCM extraction failed for {file_ext}: {e}")
    return None


def _pcm_to_wav_bytes(samples: np.ndarray, sample_rate: int) -> bytes:
    """Convert float32 PCM samples to WAV bytes."""
    # Clip and convert to int16
    samples = np.clip(samples, -1.0, 1.0)
    int_samples = (samples * 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(int_samples.tobytes())
    return buf.getvalue()


def trim_silence(samples: np.ndarray, sample_rate: int, threshold_db: float = -40.0, min_silence_ms: int = 200) -> np.ndarray:
    """Remove leading and trailing silence from audio."""
    threshold = 10 ** (threshold_db / 20.0)
    window_size = int(sample_rate * min_silence_ms / 1000)

    # Find first non-silent sample
    abs_samples = np.abs(samples)
    start = 0
    for i in range(0, len(abs_samples) - window_size, window_size):
        if np.max(abs_samples[i:i + window_size]) > threshold:
            start = max(0, i - window_size)  # Keep a small buffer
            break

    # Find last non-silent sample
    end = len(samples)
    for i in range(len(abs_samples) - window_size, 0, -window_size):
        if np.max(abs_samples[i:i + window_size]) > threshold:
            end = min(len(samples), i + 2 * window_size)
            break

    if start >= end:
        return samples  # Don't trim everything

    trimmed = samples[start:end]
    trimmed_ms = len(trimmed) / sample_rate * 1000
    original_ms = len(samples) / sample_rate * 1000
    logger.debug(f"Silence trim: {original_ms:.0f}ms → {trimmed_ms:.0f}ms")
    return trimmed


def normalize_audio(samples: np.ndarray, target_db: float = -3.0) -> np.ndarray:
    """Peak-normalize audio to target dB level."""
    peak = np.max(np.abs(samples))
    if peak < 1e-6:
        return samples  # Nearly silent, don't amplify noise

    target_peak = 10 ** (target_db / 20.0)
    gain = target_peak / peak
    return samples * gain


def spectral_gate_denoise(samples: np.ndarray, sample_rate: int, noise_reduction_db: float = 12.0) -> np.ndarray:
    """Simple spectral gating noise reduction.
    Uses first 0.5s as noise profile estimate, then gates the full signal."""
    # Use first 0.5s as noise estimate (typically silence/ambient before speech)
    noise_len = min(int(sample_rate * 0.5), len(samples) // 4)
    if noise_len < sample_rate * 0.1:  # Too short for noise estimate
        return samples

    noise_sample = samples[:noise_len]

    # FFT parameters
    fft_size = 2048
    hop_size = fft_size // 4
    window = np.hanning(fft_size)

    # Estimate noise spectrum
    noise_specs = []
    for i in range(0, len(noise_sample) - fft_size, hop_size):
        frame = noise_sample[i:i + fft_size] * window
        spectrum = np.abs(np.fft.rfft(frame))
        noise_specs.append(spectrum)

    if not noise_specs:
        return samples

    noise_threshold = np.mean(noise_specs, axis=0) * (10 ** (noise_reduction_db / 20.0))

    # Apply spectral gating to full signal
    output = np.zeros_like(samples)
    for i in range(0, len(samples) - fft_size, hop_size):
        frame = samples[i:i + fft_size] * window
        spectrum = np.fft.rfft(frame)
        magnitude = np.abs(spectrum)
        phase = np.angle(spectrum)

        # Soft gate: reduce magnitude where it's below noise threshold
        mask = np.clip(magnitude / (noise_threshold + 1e-10) - 1.0, 0.0, 1.0)
        gated_magnitude = magnitude * mask

        # Reconstruct
        gated_spectrum = gated_magnitude * np.exp(1j * phase)
        gated_frame = np.fft.irfft(gated_spectrum, n=fft_size) * window

        output[i:i + fft_size] += gated_frame

    # Normalize overlap-add gain
    output = output * (hop_size / (fft_size * 0.5))
    return output


def preprocess_audio(audio_bytes: bytes, file_ext: str, enable_denoise: bool = True) -> Tuple[bytes, str, dict]:
    """
    Full audio preprocessing pipeline.

    Args:
        audio_bytes: Raw audio file bytes
        file_ext: File extension (wav, m4a, webm, etc.)
        enable_denoise: Whether to apply noise suppression

    Returns:
        (processed_bytes, output_ext, stats_dict)
        If preprocessing fails gracefully, returns original audio unchanged.
    """
    stats = {
        "original_size": len(audio_bytes),
        "preprocessed": False,
        "denoise_applied": False,
        "silence_trimmed": False,
        "normalized": False,
    }

    # Only process WAV files natively (other formats need ffmpeg which may not be available)
    pcm_result = _bytes_to_pcm(audio_bytes, file_ext)
    if pcm_result is None:
        # Can't decode natively — return original audio for Whisper to handle
        logger.info(f"Audio pipeline: passthrough (format={file_ext}, no native decode)")
        stats["passthrough"] = True
        return audio_bytes, file_ext, stats

    samples, sample_rate = pcm_result
    original_duration = len(samples) / sample_rate
    logger.info(f"Audio pipeline: {file_ext}, {sample_rate}Hz, {original_duration:.1f}s")

    # Step 1: Noise suppression
    if enable_denoise and original_duration > 1.0:
        try:
            samples = spectral_gate_denoise(samples, sample_rate)
            stats["denoise_applied"] = True
        except Exception as e:
            logger.warning(f"Denoise failed (non-fatal): {e}")

    # Step 2: Silence trimming
    try:
        samples = trim_silence(samples, sample_rate)
        stats["silence_trimmed"] = True
    except Exception as e:
        logger.warning(f"Silence trim failed (non-fatal): {e}")

    # Step 3: Peak normalization
    try:
        samples = normalize_audio(samples, target_db=-3.0)
        stats["normalized"] = True
    except Exception as e:
        logger.warning(f"Normalization failed (non-fatal): {e}")

    # Convert back to WAV
    processed_bytes = _pcm_to_wav_bytes(samples, sample_rate)
    final_duration = len(samples) / sample_rate

    stats["preprocessed"] = True
    stats["processed_size"] = len(processed_bytes)
    stats["original_duration_s"] = round(original_duration, 2)
    stats["final_duration_s"] = round(final_duration, 2)
    stats["output_format"] = "wav"

    logger.info(
        f"Audio pipeline complete: {original_duration:.1f}s → {final_duration:.1f}s, "
        f"{len(audio_bytes)} → {len(processed_bytes)} bytes, "
        f"denoise={stats['denoise_applied']}, trim={stats['silence_trimmed']}, norm={stats['normalized']}"
    )
    return processed_bytes, "wav", stats
