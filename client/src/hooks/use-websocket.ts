import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface WebSocketOptions {
  onMessage?: (data: any) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export function useWebSocket(options: WebSocketOptions = {}) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
  const {
    onMessage,
    reconnectAttempts = 3,
    reconnectInterval = 5000
  } = options;

  const connect = useCallback(async () => {
    try {
      console.log("Attempting to get WebSocket auth token...");
      const response = await fetch('/api/ws-auth', { 
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.error("Failed to get WS auth token:", response.status, response.statusText);
        throw new Error(`Failed to get WebSocket auth token: ${response.statusText}`);
      }

      const { token } = await response.json();
      console.log("WebSocket token received successfully");

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
      console.log("Connecting to WebSocket:", wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connection established");
        setIsConnected(true);
        toast({
          title: 'Connected',
          description: 'Real-time connection established.',
        });
      };

      ws.onclose = (event) => {
        console.log("WebSocket connection closed:", event.code, event.reason);
        setIsConnected(false);
        setSocket(null);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws.close();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message received:", data);
          onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      setSocket(ws);

      return () => {
        ws.close();
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      toast({
        title: 'Connection Error',
        description: error instanceof Error ? error.message : 'Failed to establish real-time connection.',
        variant: 'destructive',
      });
    }
  }, [onMessage, toast]);

  useEffect(() => {
    let reconnectCount = 0;
    let reconnectTimer: number;

    const attemptConnection = () => {
      if (reconnectCount < reconnectAttempts) {
        console.log(`Attempting connection (${reconnectCount + 1}/${reconnectAttempts})`);
        connect();
        reconnectCount++;
      }
    };

    console.log("Checking authentication before connecting...");
    fetch('/api/user', { credentials: 'include' })
      .then(response => {
        if (response.ok) {
          console.log("User authenticated, initiating WebSocket connection");
          attemptConnection();
        } else {
          console.error("Authentication check failed:", response.status);
          toast({
            title: 'Authentication Required',
            description: 'Please log in to use real-time features.',
            variant: 'destructive',
          });
        }
      })
      .catch((error) => {
        console.error("Error checking authentication:", error);
        reconnectTimer = window.setTimeout(attemptConnection, reconnectInterval);
      });

    return () => {
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [connect, reconnectAttempts, reconnectInterval, socket, toast]);

  return {
    isConnected,
    socket
  };
}