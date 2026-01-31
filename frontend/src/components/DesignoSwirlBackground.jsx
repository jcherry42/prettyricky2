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
const DesignoSwirlBackground = ({ intensity = 1, prominence = 1 }) => {
  // The swirl should read as “material” not “graphics”, but the user asked for stronger presence.
  // We achieve this by scaling opacity and boosting certain layer alphas (still keeping legibility via vignette).
  const opacity = 0.42 * intensity * prominence;

  return (
    <div aria-hidden="true" className="designo-swirl-bg" style={{ opacity }}>
      <div className="designo-swirl-vignette" />

      {/* “Pass swirls” — soft, hand-painted ribbons */}
      <div className="designo-swirl-pass designo-swirl-pass-a" />
      <div className="designo-swirl-pass designo-swirl-pass-b" />
      <div className="designo-swirl-pass designo-swirl-pass-c" />

      {/* Micro-material layers: stitch + grain */}
      <div className="designo-swirl-stitch" />
      <div className="designo-swirl-noise" />

      {/* Subtle glass sweep (very slow) */}
      <div className="designo-swirl-glass" />

      <style>{`
        .designo-swirl-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          isolation: isolate;
          filter: saturate(1.08) contrast(1.02);
        }

        .designo-swirl-bg > * {
          position: absolute;
          inset: -18%;
          will-change: transform;
        }

        /* A gentle vignette to keep edges calm and premium */
        .designo-swirl-vignette {
          inset: 0;
          background:
            radial-gradient(ellipse 120% 90% at 50% 30%, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.22) 72%, rgba(0,0,0,0.44) 100%);
          mix-blend-mode: multiply;
          opacity: 0.75;
        }

        /* Palette derived from the reference: aubergine/magenta + amber + teal/cyan */
        .designo-swirl-pass {
          mix-blend-mode: screen;
          filter: blur(14px);
          opacity: 0.56;
        }

        .designo-swirl-pass-a {
          background:
            radial-gradient(ellipse 58% 44% at 18% 46%, rgba(165, 30, 78, 0.18) 0%, transparent 62%),
            radial-gradient(ellipse 54% 60% at 78% 62%, rgba(25, 150, 190, 0.14) 0%, transparent 64%),
            radial-gradient(ellipse 46% 46% at 52% 18%, rgba(255, 195, 110, 0.10) 0%, transparent 62%);
          animation: designo-pass-drift-a 22s ease-in-out infinite;
        }

        /* A conic “swirl” that suggests brushed paint strokes */
        .designo-swirl-pass-b {
          background:
            conic-gradient(from 190deg at 40% 48%,
              transparent 0deg,
              rgba(255, 195, 110, 0.07) 35deg,
              transparent 110deg,
              rgba(165, 30, 78, 0.06) 200deg,
              transparent 305deg
            );
          opacity: 0.42;
          filter: blur(18px);
          animation: designo-pass-drift-b 34s ease-in-out infinite;
        }

        /* Cooler ribbon to keep the composition “designo” rather than “neon” */
        .designo-swirl-pass-c {
          background:
            radial-gradient(ellipse 70% 44% at 50% 58%, rgba(0, 195, 255, 0.07) 0%, transparent 66%),
            radial-gradient(ellipse 45% 58% at 64% 44%, rgba(0, 255, 168, 0.045) 0%, transparent 70%),
            radial-gradient(ellipse 38% 38% at 28% 22%, rgba(255, 210, 150, 0.05) 0%, transparent 70%);
          opacity: 0.35;
          filter: blur(22px);
          animation: designo-pass-drift-c 40s ease-in-out infinite;
        }

        /* Micro “stitch / weave” that hints at leather craft (VERY subtle) */
        .designo-swirl-stitch {
          inset: 0;
          mix-blend-mode: overlay;
          opacity: 0.10;
          background:
            repeating-linear-gradient(45deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 18px),
            repeating-linear-gradient(-45deg, rgba(0,0,0,0.025) 0px, rgba(0,0,0,0.025) 1px, transparent 1px, transparent 18px);
          animation: designo-stitch-shift 60s linear infinite;
        }

        /* Fine film grain using an SVG turbulence texture */
        .designo-swirl-noise {
          inset: 0;
          opacity: 0.09;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E");
          background-size: 220px 220px;
          animation: designo-noise-jitter 1.8s steps(2) infinite;
        }

        /* Glass-like slow sweep to mimic cockpit reflections */
        .designo-swirl-glass {
          inset: 0;
          mix-blend-mode: screen;
          opacity: 0.18;
          background:
            linear-gradient(115deg,
              transparent 0%,
              rgba(255, 255, 255, 0.00) 40%,
              rgba(255, 255, 255, 0.045) 49%,
              rgba(255, 230, 170, 0.04) 52%,
              rgba(255, 255, 255, 0.035) 56%,
              rgba(255, 255, 255, 0.00) 68%,
              transparent 100%
            );
          transform: translate3d(-55%, 0, 0) rotate(-10deg);
          animation: designo-glass-sweep 22s ease-in-out infinite;
        }

        @keyframes designo-pass-drift-a {
          0% { transform: translate3d(-2%, -1%, 0) rotate(-1deg) scale(1.02); }
          50% { transform: translate3d(2%, 1.6%, 0) rotate(1.8deg) scale(1.05); }
          100% { transform: translate3d(-2%, -1%, 0) rotate(-1deg) scale(1.02); }
        }

        @keyframes designo-pass-drift-b {
          0% { transform: translate3d(2.5%, -1.8%, 0) rotate(0deg) scale(1.03); }
          50% { transform: translate3d(-2.2%, 1.4%, 0) rotate(8deg) scale(1.08); }
          100% { transform: translate3d(2.5%, -1.8%, 0) rotate(0deg) scale(1.03); }
        }

        @keyframes designo-pass-drift-c {
          0% { transform: translate3d(0%, 1.2%, 0) rotate(0deg) scale(1.02); }
          50% { transform: translate3d(0%, -1.2%, 0) rotate(-6deg) scale(1.06); }
          100% { transform: translate3d(0%, 1.2%, 0) rotate(0deg) scale(1.02); }
        }

        @keyframes designo-stitch-shift {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(2.5%, 1.5%, 0); }
        }

        @keyframes designo-noise-jitter {
          0% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0.5%, -0.4%, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }

        @keyframes designo-glass-sweep {
          0% { opacity: 0.0; transform: translate3d(-65%, 0, 0) rotate(-10deg); }
          10% { opacity: 0.18; }
          55% { opacity: 0.16; }
          75% { opacity: 0.0; transform: translate3d(65%, 0, 0) rotate(-10deg); }
          100% { opacity: 0.0; transform: translate3d(65%, 0, 0) rotate(-10deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .designo-swirl-pass,
          .designo-swirl-stitch,
          .designo-swirl-noise,
          .designo-swirl-glass {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default memo(DesignoSwirlBackground);
