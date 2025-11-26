import React, { useState } from 'react';
import './ChannelCard.css';

const ChannelCard = ({ channel, onClick }) => {
  const title = channel.snippet.title;
  const description = channel.snippet.description;
  const channelId = channel.id.channelId || channel.snippet.channelId;
  
  // Tentar diferentes tamanhos de thumbnail em ordem de preferência
  const getThumbnailUrl = () => {
    if (!channel || !channel.snippet) return null;
    
    const thumbnails = channel.snippet.thumbnails;
    if (!thumbnails) return null;
    
    // Tentar diferentes tamanhos em ordem de qualidade
    const url = thumbnails?.high?.url || 
                thumbnails?.medium?.url || 
                thumbnails?.default?.url ||
                null;
    
    // Validar URL
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      return url;
    }
    
    return null;
  };
  
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const thumbnailUrl = getThumbnailUrl();
  
  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };
  
  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };
  
  // Obter iniciais do canal para o placeholder
  const getInitials = (name) => {
    if (!name) return '?';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  const initials = getInitials(title);

  return (
    <div 
      className="channel-card"
      onClick={onClick}
    >
      <div className="channel-thumbnail">
        {!imageError && thumbnailUrl ? (
          <img 
            src={thumbnailUrl} 
            alt={title}
            onError={handleImageError}
            onLoad={handleImageLoad}
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
        ) : null}
        {imageError || !thumbnailUrl ? (
          <div className="channel-thumbnail-placeholder">
            <span className="channel-initials">{initials}</span>
          </div>
        ) : !imageLoaded ? (
          <div className="channel-thumbnail-loading">
            <div className="loading-spinner"></div>
          </div>
        ) : null}
      </div>
      <div className="channel-info">
        <h3 className="channel-title" title={title}>
          {title}
        </h3>
        {description && (
          <p className="channel-description" title={description}>
            {description.length > 100 ? `${description.substring(0, 100)}...` : description}
          </p>
        )}
        <div className="channel-action">
          <span className="view-shorts-btn">Ver Shorts deste canal →</span>
        </div>
      </div>
    </div>
  );
};

export default ChannelCard;

