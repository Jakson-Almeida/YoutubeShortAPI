import React from 'react';
import './ChannelList.css';
import ChannelCard from './ChannelCard';

const ChannelList = ({ channels, onChannelSelect }) => {
  if (channels.length === 0) {
    return (
      <div className="no-channels">
        <p>🔍 Nenhum canal encontrado.</p>
      </div>
    );
  }

  return (
    <div className="channel-list-container">
      <h2 className="channel-list-title">
        {channels.length} canal{channels.length !== 1 ? 'is' : ''} encontrado{channels.length !== 1 ? 's' : ''}
      </h2>
      <div className="channel-grid">
        {channels.map((channel) => (
          <ChannelCard
            key={channel.id.channelId || channel.snippet.channelId}
            channel={channel}
            onClick={() => onChannelSelect(channel)}
          />
        ))}
      </div>
    </div>
  );
};

export default ChannelList;

