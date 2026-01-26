import React, { useEffect, useState } from 'react';
import { teamLogos } from '../teams.js';

const NewsBar = ({ activeSave }) => {
  const [tickerItems, setTickerItems] = useState([]);
  
  useEffect(() => {
    if (!activeSave) return;
    
    const items = [];
    
    // 1. Add latest inbox messages (top 3)
    if (activeSave.inbox && activeSave.inbox.length > 0) {
      activeSave.inbox.slice(0, 3).forEach(msg => {
        items.push({
          type: 'news',
          text: msg.subject,
          sender: msg.sender
        });
      });
    }
    
    // 2. Add recent roster changes if any
    // We can infer these from the week report or just generate some generic ones if not available
    // For now, let's look for roster changes in the latest message body if it's a Week Report
    const latestReport = activeSave.inbox?.find(m => m.subject.includes('Week') && m.subject.includes('Report'));
    if (latestReport && latestReport.body) {
        const lines = latestReport.body.split('\n');
        lines.forEach(line => {
            if (line.startsWith('- ')) {
                items.push({
                    type: 'roster',
                    text: line.substring(2)
                });
            }
        });
    }

    // 3. Add generic league news if items are low
    if (items.length < 3) {
        items.push({ type: 'news', text: 'VCT Season underway. All eyes on the trophy.' });
        items.push({ type: 'news', text: 'Scouts reporting high potential in recent free agent pool.' });
    }
    
    setTickerItems(items);
  }, [activeSave]);

  if (!activeSave || tickerItems.length === 0) return null;

  return (
    <div className="news-bar">
      <div className="news-label">
        <span className="live-dot"></span>
        LEAGUE NEWS
      </div>
      <div className="ticker-container">
        <div className="ticker-content">
          {tickerItems.map((item, index) => (
            <div key={index} className="ticker-item">
              <span className={`item-tag ${item.type}`}>{item.type.toUpperCase()}</span>
              <span className="item-text">
                {item.sender && <span className="item-sender">{item.sender}: </span>}
                {item.text}
              </span>
              <span className="item-divider">//</span>
            </div>
          ))}
          {/* Duplicate items for seamless loop */}
          {tickerItems.map((item, index) => (
            <div key={`dup-${index}`} className="ticker-item">
              <span className={`item-tag ${item.type}`}>{item.type.toUpperCase()}</span>
              <span className="item-text">
                {item.sender && <span className="item-sender">{item.sender}: </span>}
                {item.text}
              </span>
              <span className="item-divider">//</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NewsBar;
