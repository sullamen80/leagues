// src/gameTypes/nflPlayoffs/components/TournamentIcon.js
import React from 'react';

/**
 * Tournament logo/icon for NFL Playoffs
 * Football-inspired shield with AFC/NFC callouts and Lombardi Trophy
 */
const TournamentIcon = ({ size = 64, color = '#013369' }) => {
  const accent = '#D50A0A'; // NFL red
  const gold = '#D4AF37';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shield background */}
      <path
        d="M8 12L8 34C8 45 18 56 32 60C46 56 56 45 56 34V12L32 4L8 12Z"
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeWidth="2"
      />

      {/* Field hash marks */}
      {[16, 24, 32, 40, 48].map((x) => (
        <line
          key={x}
          x1={x}
          y1={16}
          x2={x}
          y2={48}
          stroke={color}
          strokeWidth="1"
          strokeDasharray="4 4"
          strokeOpacity="0.4"
        />
      ))}

      {/* AFC ribbon */}
      <path
        d="M12 22H24L26 26L24 30H12Z"
        fill={accent}
        stroke={accent}
        strokeWidth="1.5"
      />
      <text x="15" y="28" fontSize="6" fill="white" fontWeight="bold">AFC</text>

      {/* NFC ribbon */}
      <path
        d="M52 22H40L38 26L40 30H52Z"
        fill={color}
        stroke={color}
        strokeWidth="1.5"
      />
      <text x="41.5" y="28" fontSize="6" fill="white" fontWeight="bold">NFC</text>

      {/* Lombardi Trophy */}
      <path
        d="M29 34L32 20L35 34C35.5 36 34.5 38 33 39L32 51L31 39C29.5 38 28.5 36 29 34Z"
        stroke={gold}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="32" cy="19" r="5" stroke={gold} strokeWidth="1.5" fill="none" />

      {/* Football laces */}
      <ellipse cx="32" cy="44" rx="9" ry="6" fill="white" opacity="0.25" />
      <line x1="26" y1="44" x2="38" y2="44" stroke="white" strokeWidth="1.5" />
      <line x1="30" y1="42" x2="30" y2="46" stroke="white" strokeWidth="1" />
      <line x1="32" y1="42" x2="32" y2="46" stroke="white" strokeWidth="1" />
      <line x1="34" y1="42" x2="34" y2="46" stroke="white" strokeWidth="1" />

      {/* Super Bowl banner */}
      <rect
        x="18"
        y="52"
        width="28"
        height="6"
        rx="3"
        fill={accent}
      />
      <text
        x="32"
        y="56.5"
        fontSize="4.5"
        fill="white"
        fontWeight="bold"
        textAnchor="middle"
      >
        SUPER BOWL
      </text>
    </svg>
  );
};

export default TournamentIcon;
