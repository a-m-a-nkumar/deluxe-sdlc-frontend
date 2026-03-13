import { useState, useEffect } from 'react';

export const useTypingEffect = (text: string, speed: number = 15) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!text) return;

    setIsTyping(true);
    setDisplayedText('');
    
    const lines = text.split('\n');
    let lineIndex = 0;
    
    const timer = setInterval(() => {
      if (lineIndex < lines.length) {
        setDisplayedText(prev => {
          if (lineIndex === 0) {
            return lines[lineIndex];
          } else {
            return prev + '\n' + lines[lineIndex];
          }
        });
        lineIndex++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayedText, isTyping };
};