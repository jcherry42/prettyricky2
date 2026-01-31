import React, { memo } from 'react';

/**
 * DesignoSwirlBackground
 *
 * Global “designo / pass-swirl” layer inspired by the Mercedes designo interior program.
 * 
 * Goals:
 * - Subtle (premium), not distracting
 * - GPU-friendly (pure CSS gradients)
 * - Works across the app without layout impact
 */
const DesignoSwirlBackground = ({ intensity = 1 }) => {
  return (
    <div
      aria-hidden="true"
      className="designo-swirl-bg"
      style={{ opacity: 0.55 * intensity }}
    >
      <div className="designo-swirl-layer designo-swirl-layer-a" />
      <div className="designo-swirl-layer designo-swirl-layer-b" />
      <div className="designo-swirl-layer designo-swirl-layer-c" />

      <style>{`
        .designo-swirl-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          mix-blend-mode: screen;
          filter: saturate(1.05);
        }

        .designo-swirl-layer {
          position: absolute;
          inset: -20%;
          will-change: transform;
          opacity: 0.55;
        }

        /* Palette tuned from reference images: deep aubergine + warm amber + cool teal */
        .designo-swirl-layer-a {
          background:
            radial-gradient(ellipse 55% 40% at 18% 38%, rgba(150, 35, 70, 0.18) 0%, transparent 60%),
            radial-gradient(ellipse 45% 55% at 82% 64%, rgba(35, 120, 160, 0.14) 0%, transparent 62%),
            radial-gradient(ellipse 55% 55% at 44% 18%, rgba(255, 185, 90, 0.10) 0%, transparent 60%);
          animation: designo-swirl-drift-a 18s ease-in-out infinite;
        }

        .designo-swirl-layer-b {
          background:
            conic-gradient(from 210deg at 36% 48%,
              transparent 0deg,
              rgba(255, 185, 90, 0.07) 42deg,
              transparent 120deg,
              rgba(150, 35, 70, 0.06) 210deg,
              transparent 320deg
            );
          filter: blur(10px);
          opacity: 0.45;
          animation: designo-swirl-drift-b 26s ease-in-out infinite;
        }

        .designo-swirl-layer-c {
          background:
            radial-gradient(ellipse 70% 45% at 50% 52%, rgba(255,255,255,0.03) 0%, transparent 62%),
            radial-gradient(ellipse 80% 50% at 55% 55%, rgba(255, 185, 90, 0.06) 0%, transparent 65%);
          filter: blur(14px);
          opacity: 0.35;
          animation: designo-swirl-drift-c 32s ease-in-out infinite;
        }

        @keyframes designo-swirl-drift-a {
          0% { transform: translate3d(-2%, -1%, 0) rotate(-1deg) scale(1.02); }
          50% { transform: translate3d(2%, 1.5%, 0) rotate(1.2deg) scale(1.04); }
          100% { transform: translate3d(-2%, -1%, 0) rotate(-1deg) scale(1.02); }
        }

        @keyframes designo-swirl-drift-b {
          0% { transform: translate3d(2%, -1.5%, 0) rotate(0deg) scale(1.03); }
          50% { transform: translate3d(-2%, 1.25%, 0) rotate(6deg) scale(1.06); }
          100% { transform: translate3d(2%, -1.5%, 0) rotate(0deg) scale(1.03); }
        }

        @keyframes designo-swirl-drift-c {
          0% { transform: translate3d(0%, 1%, 0) rotate(0deg) scale(1.02); }
          50% { transform: translate3d(0%, -1%, 0) rotate(-4deg) scale(1.05); }
          100% { transform: translate3d(0%, 1%, 0) rotate(0deg) scale(1.02); }
        }

        @media (prefers-reduced-motion: reduce) {
          .designo-swirl-layer {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default memo(DesignoSwirlBackground);
