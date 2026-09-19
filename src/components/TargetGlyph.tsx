import React from 'react';

interface TargetGlyphProps {
  type: 'standard' | 'golden' | 'hazard' | 'freeze' | 'surge' | 'multi' | 'vortex' | 'phantom' | 'sabotage';
  color: string;
  hitsRemaining?: number;
  maxHits?: number;
  size?: number;
}

export const TargetGlyph: React.FC<TargetGlyphProps> = ({
  type,
  color,
  hitsRemaining = 1,
  size = 32,
}) => {
  switch (type) {
    case 'hazard':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="animate-spin-slow">
          <circle cx="20" cy="20" r="17" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 3" opacity="0.8" />
          <polygon points="20,6 34,31 6,31" stroke="#fca5a5" strokeWidth="2.5" fill="#ef4444" fillOpacity="0.25" />
          <line x1="20" y1="14" x2="20" y2="23" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="20" cy="27" r="1.5" fill="#ffffff" />
        </svg>
      );

    case 'golden':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="animate-pulse">
          {/* Starburst rays */}
          <path
            d="M20 3 L23 15 L35 15 L25 22 L29 34 L20 26 L11 34 L15 22 L5 15 L17 15 Z"
            fill="url(#goldGradient)"
            stroke="#fef08a"
            strokeWidth="1.5"
          />
          <circle cx="20" cy="20" r="4.5" fill="#ffffff" />
          <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'freeze':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="16" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6" strokeDasharray="3 3" />
          {/* Snowflake crystal */}
          <line x1="20" y1="7" x2="20" y2="33" stroke="#a5f3fc" strokeWidth="2" strokeLinecap="round" />
          <line x1="7" y1="20" x2="33" y2="20" stroke="#a5f3fc" strokeWidth="2" strokeLinecap="round" />
          <line x1="11" y1="11" x2="29" y2="29" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="11" y1="29" x2="29" y2="11" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
          {/* Crystal diamond center */}
          <rect x="17" y="17" width="6" height="6" transform="rotate(45 20 20)" fill="#ffffff" />
        </svg>
      );

    case 'surge':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
          {/* Hexagonal energy shield */}
          <polygon
            points="20,6 32,13 32,27 20,34 8,27 8,13"
            stroke="#c084fc"
            strokeWidth="2"
            fill="#a855f7"
            fillOpacity="0.3"
          />
          <path
            d="M20 12 L27 16 V23 C27 27 20 30 20 30 C20 30 13 27 13 23 V16 Z"
            fill="#ffffff"
            opacity="0.9"
          />
        </svg>
      );

    case 'multi':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
          {/* Double ring with crack lines and counter */}
          <circle cx="20" cy="20" r="17" stroke="#ec4899" strokeWidth="2.5" strokeDasharray={hitsRemaining === 2 ? "12 4" : "4 4"} />
          <circle cx="20" cy="20" r="11" fill="#f43f5e" fillOpacity="0.4" stroke="#fb7185" strokeWidth="1.5" />
          {/* Number of hits left badge */}
          <text
            x="20"
            y="25"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="14"
            fontWeight="900"
            fontFamily="monospace"
          >
            {hitsRemaining}
          </text>
        </svg>
      );

    case 'vortex':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="animate-spin-slow">
          {/* Swirling black hole spiral accretion arms */}
          <circle cx="20" cy="20" r="17" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.7" />
          <path
            d="M20 8 C27 8 32 13 32 20 C32 24 29 28 25 28 C21 28 18 25 18 21 C18 17 21 14 24 14"
            stroke="#c4b5fd"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M20 32 C13 32 8 27 8 20 C8 16 11 12 15 12 C19 12 22 15 22 19 C22 23 19 26 16 26"
            stroke="#a78bfa"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="20" cy="20" r="3.5" fill="#ffffff" />
        </svg>
      );

    case 'phantom':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="animate-pulse">
          {/* Ethereal quantum rings */}
          <ellipse cx="20" cy="20" rx="16" ry="7" transform="rotate(-30 20 20)" stroke="#22d3ee" strokeWidth="1.8" opacity="0.8" />
          <ellipse cx="20" cy="20" rx="16" ry="7" transform="rotate(30 20 20)" stroke="#a855f7" strokeWidth="1.8" opacity="0.8" />
          <circle cx="20" cy="20" r="4.5" fill="#67e8f9" />
          <circle cx="20" cy="20" r="2" fill="#ffffff" />
        </svg>
      );

    case 'sabotage':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="16" stroke="#ec4899" strokeWidth="2" strokeDasharray="3 3" />
          <path d="M12 14 L28 26 M28 14 L12 26" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" />
          <circle cx="20" cy="20" r="3" fill="#ffffff" />
        </svg>
      );

    case 'standard':
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
          {/* Precision crosshair reticle with core */}
          <circle cx="20" cy="20" r="15" stroke={color} strokeWidth="2" opacity="0.7" />
          <line x1="20" y1="3" x2="20" y2="8" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="20" y1="32" x2="20" y2="37" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="3" y1="20" x2="8" y2="20" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="32" y1="20" x2="37" y2="20" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          {/* Pulsing focal nucleus */}
          <circle cx="20" cy="20" r="5" fill={color} />
          <circle cx="20" cy="20" r="2.5" fill="#ffffff" />
        </svg>
      );
  }
};
