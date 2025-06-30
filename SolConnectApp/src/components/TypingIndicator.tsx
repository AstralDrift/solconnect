import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTypingUsers } from '../hooks/useTypingIndicator';

interface TypingIndicatorProps {
  sessionId: string;
  className?: string;
  showUsernames?: boolean;
  theme?: 'light' | 'dark';
}

export function TypingIndicator({ 
  sessionId, 
  className = '', 
  showUsernames = true,
  theme = 'light' 
}: TypingIndicatorProps) {
  const typingUsers = useTypingUsers(sessionId);
  const [dots, setDots] = useState('');

  // Animate dots independently of the bounce animation
  useEffect(() => {
    if (typingUsers.length === 0) {
      setDots('');
      return;
    }

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [typingUsers.length]);

  const getTypingMessage = () => {
    if (!showUsernames) {
      return `Someone is typing${dots}`;
    }

    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing${dots}`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0]} and ${typingUsers[1]} are typing${dots}`;
    } else if (typingUsers.length > 2) {
      return `${typingUsers.length} people are typing${dots}`;
    }
    return '';
  };

  if (typingUsers.length === 0) {
    return null;
  }

  const isDark = theme === 'dark';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={`flex items-center space-x-2 p-2 ${className}`}
      >
        {/* Animated dots */}
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={`w-2 h-2 rounded-full ${
                isDark ? 'bg-gray-400' : 'bg-gray-600'
              }`}
              animate={{
                y: [0, -4, 0],
                opacity: [0.4, 1, 0.4]
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>

        {/* Typing message */}
        {showUsernames && (
          <motion.span
            className={`text-sm ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {getTypingMessage()}
          </motion.span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Compact typing indicator with just animated dots
 */
export function CompactTypingIndicator({ 
  sessionId, 
  className = '',
  theme = 'light' 
}: Omit<TypingIndicatorProps, 'showUsernames'>) {
  return (
    <TypingIndicator 
      sessionId={sessionId} 
      className={className}
      showUsernames={false}
      theme={theme}
    />
  );
} 