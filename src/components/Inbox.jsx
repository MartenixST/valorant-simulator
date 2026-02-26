import React from 'react';

const Inbox = ({ inbox, onMessageClick, selectedMessage }) => {

  return (
    <div className="inbox box">
      <h3>Inbox</h3>
      <div id="inbox-list">
          {inbox.map((message, index) => (
            <div
              key={message.id || `${message.subject}-${index}`}
              className={`inbox-item ${selectedMessage && selectedMessage.id === message.id ? 'selected' : ''}`}
              onClick={() => onMessageClick(message)}
            >
              <div className="inbox-title">{message.subject || 'No Subject'}</div>
              <div className="inbox-preview">
                {message.contentType === 'html' 
                  ? 'HTML Report' 
                  : (message.body ? message.body.substring(0, 80) + (message.body.length > 80 ? '...' : '') : '')}
              </div>
            </div>
          ))}
        </div>
    </div>
  );
};

export default Inbox;