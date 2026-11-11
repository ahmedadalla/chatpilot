'use client';

import * as React from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth-provider';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { useToast } from '../components/ui/toast';
import { OrderSocketEventPayload, OrderStatus } from '@chatpilot/contracts';

export type SocketStatus = 'connected' | 'connecting' | 'disconnected';

interface SocketContextValue {
  socket: Socket | null;
  status: SocketStatus;
}

const SocketContext = React.createContext<SocketContextValue>({
  socket: null,
  status: 'disconnected',
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const { info, success, warning } = useToast();

  const [socket, setSocket] = React.useState<Socket | null>(null);
  const [status, setStatus] = React.useState<SocketStatus>('disconnected');

  React.useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setStatus('disconnected');
      }
      return;
    }

    let activeSocket: Socket | null = null;
    let isCancelled = false;

    async function initSocket() {
      try {
        setStatus('connecting');
        // Fetch one-time token from BFF
        const { ticket } = await api.get<{ ticket: string }>('/api/socket/token');
        if (isCancelled) return;

        // Use origin-based fallback so production domains work without explicit env var
        const socketHost = process.env.NEXT_PUBLIC_WS_URL ||
          (typeof window !== 'undefined'
            ? `${window.location.origin.replace(/:\d+$/, ':3001')}`
            : 'http://127.0.0.1:3001');

        const s = io(`${socketHost}/events`, {
          query: { token: ticket },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
        });

        activeSocket = s;
        setSocket(s);

        s.on('connect', () => {
          setStatus('connected');
        });

        s.on('disconnect', () => {
          setStatus('disconnected');
        });

        s.on('connect_error', () => {
          setStatus('disconnected');
        });

        // Event: order:new
        s.on('order:new', (payload: OrderSocketEventPayload) => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
          queryClient.invalidateQueries({ queryKey: ['analytics'] });
          info(`طلب جديد #${payload.orderNumber || ''}`, 'تم استلام طلب جديد في الفرع');
        });

        // Event: order:status_changed
        s.on('order:status_changed', (payload: OrderSocketEventPayload) => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          queryClient.invalidateQueries({ queryKey: ['kitchen', 'board'] });
          queryClient.invalidateQueries({ queryKey: ['delivery', 'board'] });
          queryClient.invalidateQueries({ queryKey: ['analytics'] });

          if (payload.toStatus === OrderStatus.READY_FOR_DELIVERY) {
            success(`طلب جاهز #${payload.orderNumber || ''}`, 'الطلب جاهز للتسليم لمندوب التوصيل');
          }
        });

        // Event: delivery:order_ready
        s.on('delivery:order_ready', (payload: OrderSocketEventPayload) => {
          queryClient.invalidateQueries({ queryKey: ['delivery', 'board'] });
          info(
            `طلب جديد للتوصيل #${payload.orderNumber || ''}`,
            'تم تجهيز الطلب بالكامل وهو بانتظار خروج المندوب',
          );
        });

        // Event: platform:company_suspended
        s.on('platform:company_suspended', () => {
          warning('تنبيه أمان', 'تم تعليق حساب الشركة من قبل إدارة النظام');
          window.location.href = '/access-denied';
        });
      } catch {
        setStatus('disconnected');
      }
    }

    void initSocket();

    return () => {
      isCancelled = true;
      if (activeSocket) {
        activeSocket.disconnect();
      }
    };
  }, [isAuthenticated, user?.id]);

  return <SocketContext.Provider value={{ socket, status }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return React.useContext(SocketContext);
}
