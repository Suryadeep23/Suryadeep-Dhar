import React from 'react';

interface TheHelpingSquadLogoProps {
  className?: string;
  size?: number | string;
}

export const TheHelpingSquadLogo: React.FC<TheHelpingSquadLogoProps> = ({
  className = '',
  size = 48,
}) => {
  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Soft radial glow for the inner badge */}
        <radialGradient id="badgeBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fffdf0" />
          <stop offset="85%" stopColor="#fef8e7" />
          <stop offset="100%" stopColor="#fdeec2" />
        </radialGradient>

        {/* Gradient for painted brush ring */}
        <linearGradient id="brushRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="25%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="75%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#0f2b5c" />
        </linearGradient>

        {/* Golden heart gradient */}
        <linearGradient id="goldHeart" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>

        {/* Book golden glow */}
        <linearGradient id="bookPage" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#facc15" />
        </linearGradient>
      </defs>

      {/* Outer Painted Brush Circle Layers */}
      <circle cx="120" cy="120" r="114" stroke="#0f2b5c" strokeWidth="4" />
      <circle cx="120" cy="120" r="110" stroke="#f59e0b" strokeWidth="4.5" />

      {/* Decorative paint strokes around circumference */}
      {/* Top right blue brush */}
      <path
        d="M 120 12 A 108 108 0 0 1 224 95"
        stroke="#0284c7"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray="18 10 30 12"
      />
      <path
        d="M 140 16 A 104 104 0 0 1 220 85"
        stroke="#38bdf8"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Bottom left yellow/orange brush */}
      <path
        d="M 120 228 A 108 108 0 0 1 16 145"
        stroke="#f59e0b"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray="22 8 28 14"
      />
      <path
        d="M 100 224 A 104 104 0 0 1 20 155"
        stroke="#0284c7"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Top left yellow wash */}
      <path
        d="M 28 85 A 108 108 0 0 1 115 13"
        stroke="#facc15"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray="14 12 25 10"
      />

      {/* Badge inner background */}
      <circle cx="120" cy="120" r="102" fill="url(#badgeBg)" />

      {/* Inner thin guide ring */}
      <circle cx="120" cy="120" r="101" stroke="#0f2b5c" strokeWidth="1" strokeOpacity="0.25" />

      {/* Top Header: — THE — */}
      <line x1="56" y1="52" x2="88" y2="52" stroke="#0f2b5c" strokeWidth="3.5" strokeLinecap="round" />
      <text
        x="120"
        y="58"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="24"
        fontWeight="900"
        letterSpacing="2.5"
        fill="#0f2b5c"
      >
        THE
      </text>
      <line x1="152" y1="52" x2="184" y2="52" stroke="#0f2b5c" strokeWidth="3.5" strokeLinecap="round" />

      {/* Left Hugging Figures */}
      <g transform="translate(18, 92)">
        {/* Red Heart above left figures */}
        <path
          d="M 20 6 C 20 2, 14 0, 11 4 C 8 0, 2 2, 2 6 C 2 12, 11 17, 11 17 C 11 17, 20 12, 20 6 Z"
          fill="#dc2626"
        />
        {/* Joy burst marks */}
        <line x1="1" y1="2" x2="4" y2="5" stroke="#0f2b5c" strokeWidth="2" strokeLinecap="round" />
        <line x1="21" y1="2" x2="18" y2="5" stroke="#0f2b5c" strokeWidth="2" strokeLinecap="round" />
        <line x1="11" y1="-2" x2="11" y2="1" stroke="#0f2b5c" strokeWidth="2" strokeLinecap="round" />
        {/* Heads */}
        <circle cx="12" cy="22" r="6.5" fill="#0f2b5c" />
        <circle cx="28" cy="22" r="6.5" fill="#0f2b5c" />
        {/* Intertwined Hugging Body */}
        <path
          d="M 4 45 C 4 33, 10 29, 20 29 C 30 29, 36 33, 36 45 Z"
          fill="#0f2b5c"
        />
        <path
          d="M 6 38 C 14 34, 26 34, 34 38 C 34 42, 30 45, 20 45 C 10 45, 6 42, 6 38 Z"
          fill="#0f2b5c"
          stroke="#fffdf0"
          strokeWidth="1.5"
        />
      </g>

      {/* Right Hugging Figures */}
      <g transform="translate(182, 92)">
        {/* Red Heart above right figures */}
        <path
          d="M 20 6 C 20 2, 14 0, 11 4 C 8 0, 2 2, 2 6 C 2 12, 11 17, 11 17 C 11 17, 20 12, 20 6 Z"
          fill="#dc2626"
        />
        {/* Joy burst marks */}
        <line x1="1" y1="2" x2="4" y2="5" stroke="#0f2b5c" strokeWidth="2" strokeLinecap="round" />
        <line x1="21" y1="2" x2="18" y2="5" stroke="#0f2b5c" strokeWidth="2" strokeLinecap="round" />
        <line x1="11" y1="-2" x2="11" y2="1" stroke="#0f2b5c" strokeWidth="2" strokeLinecap="round" />
        {/* Heads */}
        <circle cx="12" cy="22" r="6.5" fill="#0f2b5c" />
        <circle cx="28" cy="22" r="6.5" fill="#0f2b5c" />
        {/* Intertwined Hugging Body */}
        <path
          d="M 4 45 C 4 33, 10 29, 20 29 C 30 29, 36 33, 36 45 Z"
          fill="#0f2b5c"
        />
        <path
          d="M 6 38 C 14 34, 26 34, 34 38 C 34 42, 30 45, 20 45 C 10 45, 6 42, 6 38 Z"
          fill="#0f2b5c"
          stroke="#fffdf0"
          strokeWidth="1.5"
        />
      </g>

      {/* Main Text: HELPING (Vibrant Orange Brush Lettering) */}
      <text
        x="120"
        y="108"
        textAnchor="middle"
        fontFamily="'Impact', 'Arial Black', sans-serif"
        fontSize="44"
        fontWeight="900"
        letterSpacing="1.2"
        fill="#ea580c"
      >
        HELPING
      </text>

      {/* Main Text: SQUAD (Rich Navy Blue Brush Lettering) */}
      <text
        x="120"
        y="146"
        textAnchor="middle"
        fontFamily="'Impact', 'Arial Black', sans-serif"
        fontSize="40"
        fontWeight="900"
        letterSpacing="2"
        fill="#0f2b5c"
      >
        SQUAD
      </text>

      {/* Golden Heart & Radiance above Book */}
      <g transform="translate(120, 163)">
        <path
          d="M 0 -1 C 2 -6, 9 -6, 11 -1 C 13 4, 0 12, 0 12 C 0 12, -13 4, -11 -1 C -9 -6, -2 -6, 0 -1 Z"
          fill="url(#goldHeart)"
          stroke="#d97706"
          strokeWidth="1.2"
        />
        {/* Light rays */}
        <line x1="-12" y1="-8" x2="-8" y2="-4" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        <line x1="-15" y1="2" x2="-9" y2="3" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="-8" x2="8" y2="-4" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        <line x1="15" y1="2" x2="9" y2="3" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        <line x1="0" y1="-10" x2="0" y2="-6" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Divider lines beside the book */}
      <line x1="54" y1="176" x2="80" y2="176" stroke="#0f2b5c" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="160" y1="176" x2="186" y2="176" stroke="#0f2b5c" strokeWidth="2.5" strokeLinecap="round" />

      {/* Open Golden Book */}
      <g transform="translate(120, 192)">
        {/* Book cover outline / spine */}
        <path
          d="M 0 14 C -12 8, -28 9, -40 14 L -40 -6 C -28 -11, -12 -10, 0 -5 C 12 -10, 28 -11, 40 -6 L 40 14 C 28 9, 12 8, 0 14 Z"
          fill="#0f2b5c"
        />
        {/* Left Page (Golden Yellow) */}
        <path
          d="M -2 -3 C -14 -8, -26 -8, -36 -4 L -36 10 C -26 6, -14 6, -2 11 Z"
          fill="url(#bookPage)"
          stroke="#0f2b5c"
          strokeWidth="1.5"
        />
        {/* Right Page (Golden Yellow) */}
        <path
          d="M 2 -3 C 14 -8, 26 -8, 36 -4 L 36 10 C 26 6, 14 6, 2 11 Z"
          fill="url(#bookPage)"
          stroke="#0f2b5c"
          strokeWidth="1.5"
        />
        {/* White page highlights */}
        <path
          d="M -6 -1 C -16 -5, -26 -5, -33 -2"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeOpacity="0.8"
        />
        <path
          d="M 6 -1 C 16 -5, 26 -5, 33 -2"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeOpacity="0.8"
        />
        {/* Spine center line */}
        <line x1="0" y1="-5" x2="0" y2="13" stroke="#0f2b5c" strokeWidth="2" />
      </g>
    </svg>
  );
};
