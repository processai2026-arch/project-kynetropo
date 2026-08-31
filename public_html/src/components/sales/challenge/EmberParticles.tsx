import { useMemo } from "react";

interface EmberParticlesProps {
  /** Particle count. 30 keeps the effect readable and cheap on mobile. */
  count?: number;
  /** Radius of the spawn ring, in pixels. */
  radius?: number;
}

/**
 * Ember particles pulled into the singularity (spec §33).
 *
 * Each particle is a single 6px div animated with transform + opacity only,
 * with its start offset handed to CSS as custom properties — so the whole
 * effect is one composited keyframe per node, with no per-frame JS at all.
 * Positions are computed once and memoised so a re-render never reshuffles
 * a running animation.
 */
export function EmberParticles({ count = 30, radius = 190 }: EmberParticlesProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // Spread around a ring, with a little jitter so it doesn't read as a dial.
        const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.18;
        const distance = radius * (0.72 + ((i * 37) % 40) / 100);
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          // 0–300ms stagger.
          delay: ((i * 53) % 300) / 1000,
          scale: 0.7 + ((i * 29) % 60) / 100,
        };
      }),
    [count, radius],
  );

  return (
    <div className="kyn-destroy__embers" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className="kyn-destroy__ember"
          style={
            {
              "--kyn-from-x": `${p.x}px`,
              "--kyn-from-y": `${p.y}px`,
              animationDelay: `${1.2 + p.delay}s`,
              width: `${6 * p.scale}px`,
              height: `${6 * p.scale}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default EmberParticles;
