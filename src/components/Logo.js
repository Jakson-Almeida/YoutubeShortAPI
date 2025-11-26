import React from 'react';
import './Logo.css';

const Logo = ({ size = 'medium', showText = true }) => {
  return (
    <div className={`logo-container logo-${size}`}>
      <div className="logo-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="logo-svg">
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#667eea', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#764ba2', stopOpacity:1}} />
            </linearGradient>
          </defs>
          
          {/* Background circle */}
          <circle cx="50" cy="50" r="48" fill="url(#logoGrad)"/>
          
          {/* Play icon representing video */}
          <polygon points="35,25 35,75 70,50" fill="white" opacity="0.95"/>
          
          {/* Download arrow */}
          <path d="M 50 60 L 50 80 M 45 75 L 50 80 L 55 75" 
                stroke="white" 
                strokeWidth="3" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                fill="none"/>
        </svg>
      </div>
      {showText && (
        <span className="logo-text">YouTube Shorts</span>
      )}
    </div>
  );
};

export default Logo;

