// src/gameTypes/marchMadness/components/TournamentIcon.js
import React from 'react';

/**
 * Tournament logo/icon for March Madness
 * Renders a basketball-themed bracket SVG icon
 */
const TournamentIcon = ({ size = 64, color = '#FF7F00' }) => {
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
      
      {/* Basketball Lines */}
      <circle cx="32" cy="32" r="20" stroke={color} strokeWidth="2.5" fill="none" />
      <path 
        d="M32 12C25 12 19 17 16 24M32 52C39 52 45 47 48 40" 
        stroke={color} 
        strokeWidth="2.5" 
        strokeLinecap="round"
      />
      <path 
        d="M12 32C12 25 17 19 24 16M52 32C52 39 47 45 40 48" 
        stroke={color} 
        strokeWidth="2.5" 
        strokeLinecap="round"
      />
      
      {/* Bracket Lines */}
      <path 
        d="M13 18H20V24H13" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none"
      />
      <path 
        d="M13 40H20V46H13" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none"
      />
      <path 
        d="M51 18H44V24H51" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none"
      />
      <path 
        d="M51 40H44V46H51" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none"
      />
      
      {/* Championship Trophy */}
      <path 
        d="M32 6V12M32 52V58" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
      />
      <path 
        d="M28 6H36" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
      />
      <path 
        d="M29 58H35" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
      />
    </svg>
  );
};

export default TournamentIcon;