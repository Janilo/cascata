/**
 * Cascata wordmark — descending bars glyph (evokes the price waterfall)
 * plus the "cascata" lockup. The bottom bar is mostarda (--cascata-gold)
 * to signal the margin / money line. From the Cascata DS v0.1 handoff.
 */
type Props = {
  className?: string;
  height?: number;
  /** Hide the wordmark text and render the glyph only. */
  glyphOnly?: boolean;
};

export function CascataWordmark({ className, height = 28, glyphOnly = false }: Props) {
  const viewBox = glyphOnly ? "0 0 36 40" : "0 0 196 44";
  return (
    <svg
      viewBox={viewBox}
      height={height}
      role="img"
      aria-label="Cascata"
      className={`text-[color:var(--cascata-navy)] ${className ?? ""}`}
    >
      <rect x="0" y="8" width="9" height="9" fill="currentColor" />
      <rect x="12" y="16" width="9" height="9" fill="currentColor" />
      <rect x="24" y="24" width="9" height="9" fill="currentColor" />
      <rect x="24" y="35" width="9" height="3" fill="var(--cascata-gold)" />
      {!glyphOnly && (
        <text
          x="44"
          y="32"
          fontFamily="Inter Tight, sans-serif"
          fontWeight="700"
          fontSize="25"
          letterSpacing="-0.02em"
          fill="currentColor"
        >
          cascata
        </text>
      )}
    </svg>
  );
}
