import { useEffect, useRef, useCallback, useState } from 'react';

interface SSEMessage {
  type: 'new_email' | 'notification' | 'heartbeat' | 'connected' | 'reconnect' | 'error';
  data: any;
}

interface UseRealtimeEmailsOptions {
  tempEmailId?: string;
  token?: string;
  enabled?: boolean;
  onNewEmail?: (email: any) => void;
  onNotification?: (notification: any) => void;
  baseUrl?: string;
}

export function useRealtimeEmails({
  tempEmailId,
  token,
  enabled = true,
  onNewEmail,
  onNotification,
  baseUrl = '/api'
}: UseRealtimeEmailsOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const connect = useCallback(() => {
    if (!enabled || (!tempEmailId && !token)) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Build SSE URL
    const params = new URLSearchParams();
    if (tempEmailId) params.append('temp_email_id', tempEmailId);
    if (token) params.append('token', token);
    
    const sseUrl = `${baseUrl}/emails/websocket.php?${params.toString()}`;
    
    console.log('[SSE] Connecting to:', sseUrl);
    
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] Connection opened');
      setIsConnected(true);
      setLastError(null);
      reconnectAttempts.current = 0;
    };

    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      setIsConnected(false);
      setLastError('Connection lost');
      
      eventSource.close();
      
      // Reconnect with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        console.log(`[SSE] Reconnecting in ${delay}ms...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      } else {
        setLastError('Max reconnection attempts reached');
      }
    };

    // Handle connected event
    eventSource.addEventListener('connected', (event: MessageEvent) => {
      console.log('[SSE] Connected:', event.data);
      setIsConnected(true);
    });

    // Handle new email event
    eventSource.addEventListener('new_email', (event: MessageEvent) => {
      try {
        const email = JSON.parse(event.data);
        console.log('[SSE] New email:', email);
        onNewEmail?.(email);
      } catch (e) {
        console.error('[SSE] Error parsing new_email:', e);
      }
    });

    // Handle notification event
    eventSource.addEventListener('notification', (event: MessageEvent) => {
      try {
        const notification = JSON.parse(event.data);
        console.log('[SSE] Notification:', notification);
        onNotification?.(notification);
      } catch (e) {
        console.error('[SSE] Error parsing notification:', e);
      }
    });

    // Handle heartbeat
    eventSource.addEventListener('heartbeat', (event: MessageEvent) => {
      console.log('[SSE] Heartbeat received');
    });

    // Handle reconnect request from server
    eventSource.addEventListener('reconnect', (event: MessageEvent) => {
      console.log('[SSE] Server requested reconnect');
      eventSource.close();
      setTimeout(connect, 1000);
    });

    // Handle errors from server
    eventSource.addEventListener('error', (event: MessageEvent) => {
      try {
        const error = JSON.parse(event.data);
        console.error('[SSE] Server error:', error);
        setLastError(error.error || 'Server error');
      } catch (e) {
        // Regular error event, not custom
      }
    });

  }, [tempEmailId, token, enabled, onNewEmail, onNotification, baseUrl]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastError,
    reconnect: connect,
    disconnect
  };
}

export default useRealtimeEmails;
