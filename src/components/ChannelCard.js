import React from 'react';
import './ChannelCard.css';

const ChannelCard = ({ channel, onClick }) => {
  const thumbnail = channel.snippet.thumbnails.medium?.url || channel.snippet.thumbnails.default?.url;
  const title = channel.snippet.title;
  const description = channel.snippet.description;
  const channelId = channel.id.channelId || channel.snippet.channelId;

  return (
    <div 
      className="channel-card"
      onClick={onClick}
    >
      <div className="channel-thumbnail">
        <img src={thumbnail} alt={title} />
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

