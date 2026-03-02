export default function XpensifyLogo({ size = 32, showWordmark = true }) {
  const smallH = size;
  const bigH   = smallH * 1.55;

  return (
    <div
      className="xp-logo"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        lineHeight: 1,
        userSelect: 'none',
        gap: 0,
      }}
    >

      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: `${bigH}px`,
          fontWeight: 800,
          color: 'var(--accent)',
          lineHeight: 0.9,
          display: 'block',
        }}
      >
        E
      </span>


      {showWordmark && (
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: `${smallH}px`,
            fontWeight: 800,
            color: 'var(--text)',
            lineHeight: 1,
            display: 'block',
            letterSpacing: '1px',
          }}
        >
          XPENSIFY
        </span>
      )}
    </div>
  );
}