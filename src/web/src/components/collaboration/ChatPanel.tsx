import React, { useState, useEffect, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify'; // v3.0.1
import { throttle } from 'lodash'; // v4.17.21

import { useCollaboration } from '../../hooks/useCollaboration';
import { Input } from '../ui/input';
import { CollaborationService } from '../../services/collaboration.service';
import { UserStatus } from '../../types/collaboration.types';

// Constants for performance and security
const MAX_MESSAGE_LENGTH = 500;
const MESSAGE_HISTORY_LIMIT = 100;
const RATE_LIMIT_MESSAGES = 5;
const RATE_LIMIT_INTERVAL = 1000;
const RECONNECT_INTERVAL = 3000;
const MESSAGE_BATCH_SIZE = 10;
const MESSAGE_QUEUE_LIMIT = 50;

// Interfaces
interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'error';
}

interface ChatPanelProps {
  workspaceId: string;
  userId: string;
  userName: string;
  isOpen: boolean;
  config?: {
    maxMessageLength?: number;
    historyLimit?: number;
    rateLimitMessages?: number;
    rateLimitInterval?: number;
  };
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  workspaceId,
  userId,
  userName,
  isOpen,
  config = {}
}) => {
  // State management
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const messageQueue = useRef<ChatMessage[]>([]);
  const lastMessageTime = useRef<number>(0);

  // Initialize collaboration hook
  const {
    users,
    updatePresence,
    isConnected
  } = useCollaboration(workspaceId, userId);

  // Message rate limiting
  const canSendMessage = useCallback(() => {
    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageTime.current;
    return timeSinceLastMessage >= (config.rateLimitInterval || RATE_LIMIT_INTERVAL);
  }, [config.rateLimitInterval]);

  // Message validation
  const validateMessage = useCallback((content: string): boolean => {
    if (!content.trim()) {
      setError('Message cannot be empty');
      return false;
    }

    if (content.length > (config.maxMessageLength || MAX_MESSAGE_LENGTH)) {
      setError(`Message cannot exceed ${config.maxMessageLength || MAX_MESSAGE_LENGTH} characters`);
      return false;
    }

    return true;
  }, [config.maxMessageLength]);

  // Message sanitization
  const sanitizeMessage = useCallback((content: string): string => {
    return DOMPurify.sanitize(content.trim(), {
      ALLOWED_TAGS: [], // No HTML allowed
      ALLOWED_ATTR: [] // No attributes allowed
    });
  }, []);

  // Throttled scroll to bottom
  const scrollToBottom = useCallback(
    throttle(() => {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100),
    []
  );

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      setError('Not connected to chat service');
      return;
    }

    if (!canSendMessage()) {
      setError(`Please wait before sending another message`);
      return;
    }

    if (!validateMessage(inputValue)) {
      return;
    }

    const sanitizedContent = sanitizeMessage(inputValue);

    try {
      const newMessage: ChatMessage = {
        id: crypto.randomUUID(),
        userId,
        userName,
        content: sanitizedContent,
        timestamp: new Date(),
        status: 'sent'
      };

      // Add to message queue
      messageQueue.current.push(newMessage);
      if (messageQueue.current.length > MESSAGE_QUEUE_LIMIT) {
        messageQueue.current.shift();
      }

      // Update UI immediately
      setMessages(prev => [...prev, newMessage].slice(-MESSAGE_HISTORY_LIMIT));
      setInputValue('');
      setError(null);
      lastMessageTime.current = Date.now();

      // Send message through collaboration service
      await CollaborationService.sendMessage(workspaceId, newMessage);

      // Update message status
      setMessages(prev =>
        prev.map(msg =>
          msg.id === newMessage.id ? { ...msg, status: 'delivered' } : msg
        )
      );

      scrollToBottom();
    } catch (error) {
      console.error('Failed to send message:', error);
      setError('Failed to send message. Please try again.');
      
      // Update message status to error
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageQueue.current[messageQueue.current.length - 1]?.id
            ? { ...msg, status: 'error' }
            : msg
        )
      );
    }
  };

  // Handle connection status
  useEffect(() => {
    if (!isConnected && !isReconnecting) {
      setIsReconnecting(true);
      const timer = setTimeout(() => {
        updatePresence(UserStatus.ONLINE);
        setIsReconnecting(false);
      }, RECONNECT_INTERVAL);

      return () => clearTimeout(timer);
    }
  }, [isConnected, isReconnecting, updatePresence]);

  // Render chat panel
  return (
    <div
      className={`flex flex-col h-full bg-background border-l border-border ${
        isOpen ? 'w-80' : 'w-0'
      } transition-all duration-200`}
      aria-label="Chat panel"
      role="complementary"
    >
      {isOpen && (
        <>
          {/* Header */}
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Chat</h2>
            <div className="text-sm text-muted-foreground">
              {Array.from(users.values()).filter(
                user => user.status === UserStatus.ONLINE
              ).length} online
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex flex-col ${
                  message.userId === userId ? 'items-end' : 'items-start'
                }`}
              >
                <div className="text-sm text-muted-foreground">
                  {message.userName}
                </div>
                <div
                  className={`max-w-[80%] rounded-lg p-2 ${
                    message.userId === userId
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary'
                  }`}
                >
                  {message.content}
                </div>
                {message.status === 'error' && (
                  <div className="text-xs text-destructive">
                    Failed to send. Click to retry.
                  </div>
                )}
              </div>
            ))}
            <div ref={messageEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-border">
            <Input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Type a message..."
              maxLength={config.maxMessageLength || MAX_MESSAGE_LENGTH}
              disabled={!isConnected}
              error={error || undefined}
              aria-label="Chat message input"
            />
          </form>

          {/* Connection status */}
          {!isConnected && (
            <div className="p-2 text-sm text-center text-destructive bg-destructive/10">
              Reconnecting...
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ChatPanel;