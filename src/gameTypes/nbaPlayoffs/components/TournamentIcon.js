// src/gameTypes/nbaPlayoffs/components/TournamentIcon.js
import React from 'react';

/**
 * Tournament logo/icon for NBA Playoffs
 * Renders an NBA Playoffs-themed SVG icon with trophy and conference brackets
 */
const TournamentIcon = ({ size = 64, color = '#17408B' }) => {
  // NBA primary color (blue) is used as default
  // Secondary color for accents (typically red)
  const secondaryColor = '#C9082A';
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 64 64" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background Circle */}
      <circle cx="32" cy="32" r="30" fill={color} fillOpacity="0.1" />
      
      {/* NBA-style Basketball */}
      <circle cx="32" cy="32" r="18" stroke={color} strokeWidth="2" fill="none" />
      <path 
        d="M20 22C24 28 24 36 20 42" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
      />
      <path 
        d="M44 22C40 28 40 36 44 42" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
      />
      <path 
        d="M16 32H48" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
      />
      
      {/* East Conference Bracket (Left) */}
      <path 
        d="M12 18H18V24" 
        stroke={secondaryColor} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none"
      />
      <path 
        d="M12 46H18V40" 
        stroke={secondaryColor} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none"
      />
      <path 
        d="M18 24V40" 
        stroke={secondaryColor} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none"
      />
      <text x="13" y="16" fontSize="5" fill={secondaryColor}>E</text>
      
      {/* West Conference Bracket (Right) */}
      <path 
        d="M52 18H46V24" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none"
      />
      <path 
        d="M52 46H46V40" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none"
      />
      <path 
        d="M46 24V40" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none"
      />
      <text x="47" y="16" fontSize="5" fill={color}>W</text>
      
      {/* Larry O'Brien Trophy (simplified) */}
      <path 
        d="M32 5V14" 
        stroke="gold" 
        strokeWidth="1.5" 
        strokeLinecap="round"
      />
      <path 
        d="M28 9C28 6 30 5 32 5C34 5 36 6 36 9C36 12 32 14 32 14C32 14 28 12 28 9Z" 
        stroke="gold" 
        strokeWidth="1.5" 
        fill="none"
      />
      <path 
        d="M30 58L32 52L34 58" 
        stroke="gold" 
        strokeWidth="1.5" 
        fill="none"
      />
      <path 
        d="M28 58H36" 
        stroke="gold" 
        strokeWidth="1.5" 
        strokeLinecap="round"
      />
      
      {/* Finals Line */}
      <path 
        d="M26 32H38" 
        stroke="gold" 
        strokeWidth="3" 
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
    </svg>
  );
};

export default TournamentIcon;