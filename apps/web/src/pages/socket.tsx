/* ------------------------------------------------------------------
   Car‑wash‑SaaS – Socket.io client for real‑time events
   ------------------------------------------------------------------ */

import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

/**
 * Connects to the Socket.io server running at the API URL.
 * Fires `server-event` messages that the UI can listen to.
 */
export function useSocketEvents() {
  const [connected, setConnected] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  let socket: any; // Socket.io client instance

  useEffect(() => {
    // Connect to the API backend – the Vite proxy forwards /socket.io/* to port 3212
    socket = io('http://localhost:3212', {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('server-event', (data: any) => {
      setLastEvent(JSON.stringify(data));
      console.log('Socket event received:', data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { connected, lastEvent };
}