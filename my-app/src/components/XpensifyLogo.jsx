export default function XpensifyLogo({ size = 32, showWordmark = true }) {
  const accent = 'var(--accent)';
  const text   = 'var(--text)';

  return (
    <div className="xp-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >

        <rect width="32" height="32" rx="7" fill={accent} />


        <rect x="7" y="7"  width="18" height="3.2" rx="1.2" fill="#000" />

        <rect x="7" y="14.4" width="13" height="3.2" rx="1.2" fill="#000" />

        <rect x="7" y="21.8" width="18" height="3.2" rx="1.2" fill="#000" />

        <rect x="7" y="7"   width="3.2" height="18" rx="1.2" fill="#000" />
      </svg>


      {showWordmark && (
        <span
          className="xp-logo-wordmark"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize:   `${size * 0.72}px`,
            letterSpacing: '3px',
            color: text,
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          XPENSIFY
        </span>
      )}
    </div>
  );
}