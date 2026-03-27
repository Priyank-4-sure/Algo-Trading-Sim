import { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';

interface WebSocketContextType {
  sendMessage: (action: string, payload: unknown) => void;
  isConnected: boolean;
  lastMessage: any;
  login: (username: string) => Promise<void>;
  loginWithFirebase: (firebaseToken: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  portfolio: { asset: string; balance: number }[];
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  sendMessage: () => {},
  isConnected: false,
  lastMessage: null,
  login: async () => {},
  loginWithFirebase: async () => {},
  logout: () => {},
  isAuthenticated: false,
  portfolio: [],
  selectedSymbol: 'BTC/USD',
  setSelectedSymbol: () => {},
});

export function useWebSocket() {
  return useContext(WebSocketContext);
}

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('jwt_token'));
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<{ asset: string; balance: number }[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USD');
  const wsRef = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback((token: string) => {
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `${import.meta.env.VITE_WS_URL}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected with auth');
      setIsConnected(true);
      // Fetch initial portfolio
      ws.send(JSON.stringify({ action: 'fetch_portfolio' }));
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setIsConnected(false);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);

        // Handle specific actions
        if (data.action === 'portfolio_update') {
          setPortfolio(data.payload);
        }
      } catch {
        console.error('[WS] Failed to parse message:', event.data);
      }
    };
  }, []);

  const refreshAccessToken = useCallback(async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('jwt_token', data.token);
        setIsAuthenticated(true);
        connectWebSocket(data.token);
        return true;
      }
    } catch {
      // Silent fail, user just needs to log in manually
    }
    return false;
  }, [connectWebSocket]);

  // Auto-connect if token exists, otherwise attempt silent refresh via HttpOnly cookie
  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      connectWebSocket(token);
    } else {
      refreshAccessToken();
    }
  }, [connectWebSocket, refreshAccessToken]);

  const login = useCallback(async (username: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Ensures our HttpOnly refresh cookie is sent/saved
        body: JSON.stringify({ username }),
      });

      if (!res.ok) {
        throw new Error(`Login failed: ${res.statusText}`);
      }

      const data = await res.json();
      const token = data.token;

      localStorage.setItem('jwt_token', token);
      localStorage.setItem('username', username);
      console.log('[Auth] Logged in as', username);

      setIsAuthenticated(true);
      // Establish WebSocket connection with the token
      connectWebSocket(token);
    } catch (err) {
      console.error('[Auth] Login error:', err);
      throw err; // Re-throw so the UI can show the error
    }
  }, [connectWebSocket]);

  const loginWithFirebase = useCallback(async (firebaseToken: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/v1/auth/firebase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Captures HttpOnly refresh cookie
        body: JSON.stringify({ firebase_token: firebaseToken }),
      });

      if (!res.ok) {
        throw new Error(`Firebase login failed: ${res.statusText}`);
      }

      const data = await res.json();
      const token = data.token;
      const username = data.username;

      localStorage.setItem('jwt_token', token);
      localStorage.setItem('username', username);
      console.log('[Auth] Logged in via Firebase as', username);

      setIsAuthenticated(true);
      connectWebSocket(token);
    } catch (err) {
      console.error('[Auth] Firebase login error:', err);
      throw err;
    }
  }, [connectWebSocket]);

  const logout = useCallback(async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      await fetch(`${apiUrl}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Sends cookie so server can delete it
      });
    } catch (err) {
      console.error('[Auth] Logout API error:', err);
    }

    localStorage.removeItem('jwt_token');
    localStorage.removeItem('username');
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsAuthenticated(false);
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((action: string, payload: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ action, payload });
      wsRef.current.send(message);
      console.log('[WS] Sent:', action, payload);
    } else {
      console.warn('[WS] Cannot send — socket is not connected');
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ 
      sendMessage, 
      isConnected, 
      lastMessage, 
      login, 
      loginWithFirebase, 
      logout, 
      isAuthenticated,
      portfolio,
      selectedSymbol,
      setSelectedSymbol
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}
