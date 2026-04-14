/**
 * Detection API client for object and anomaly detection
 * Now with WebSocket support for real-time streaming
 */

import { apiClient } from './api';
import { io, Socket } from 'socket.io-client';

export interface DetectionStatus {
  active: boolean;
  running?: boolean;
  fps?: number;
  detections?: number;
  anomaly_score?: number;
  is_anomaly?: boolean;
  camera_id?: number;
  message?: string;
}

export interface DetectionFrame {
  frame?: string; // base64 image data URL (optional if not ready)
  status: DetectionStatus;
  ready?: boolean; // Whether frame is ready
  message?: string; // Status message
}

class DetectionClient {
  private baseUrl: string;
  private wsBaseUrl: string;
  private socket: Socket | null = null;
  private isConnected: boolean = false;

  constructor() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    this.baseUrl = apiUrl;
    // WebSocket URL (remove /api suffix if present)
    this.wsBaseUrl = apiUrl.replace('/api', '') || 'http://localhost:5000';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('auth_token')
      : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (error: any) {
      // Network error - backend is not running
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error(
          `Backend server is not running. Please start the backend:\n` +
          `cd backend && python api_server.py`
        );
      }
      throw error;
    }

    // Check if response is HTML instead of JSON
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/json')) {
      const text = await response.text();
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        throw new Error(
          `Backend server is not running or returned HTML.\n` +
          `Please start: cd backend && python api_server.py`
        );
      }
    }

    // Handle 202 Accepted (frame not ready yet) and 503 (backward compatibility) as special cases
    if (response.status === 202 || response.status === 503) {
      try {
        const data = await response.json();
        // Ensure it has the expected structure
        return {
          ready: false,
          status: data.status || { active: true },
          message: data.message || data.error || 'Frame not ready'
        } as any;
      } catch {
        return { ready: false, status: { active: true } } as any;
      }
    }

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch {
        const text = await response.text();
        if (text) errorMessage = text.substring(0, 200);
      }
      throw new Error(errorMessage);
    }

    try {
      return await response.json();
    } catch (error: any) {
      const text = await response.text();
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        throw new Error(
          `Backend returned HTML. Please start backend: python api_server.py`
        );
      }
      throw new Error(`Invalid JSON response: ${error.message}`);
    }
  }

  async startDetection(options?: {
    camera_id?: number;
    enable_anomaly?: boolean;
  }): Promise<{ message: string; camera_id: number; anomaly_detection: boolean }> {
    return this.request('/detection/start', {
      method: 'POST',
      body: JSON.stringify({
        camera_id: options?.camera_id || 0,
        enable_anomaly: options?.enable_anomaly || false,
      }),
    });
  }

  async stopDetection(): Promise<{ message: string }> {
    return this.request('/detection/stop', {
      method: 'POST',
    });
  }

  async getStatus(): Promise<DetectionStatus> {
    return this.request<DetectionStatus>('/detection/status');
  }

  async getFrame(): Promise<DetectionFrame> {
    return this.request<DetectionFrame>('/detection/frame');
  }

  // WebSocket Methods for Real-Time Streaming
  connectWebSocket(
    callbacks: {
      onFrame?: (data: { frame: string; status: DetectionStatus; ready: boolean }) => void;
      onStatus?: (status: DetectionStatus) => void;
      onError?: (error: Error) => void;
      onConnected?: () => void;
      onDisconnected?: () => void;
    }
  ): void {
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('auth_token')
        : null;

      // Connect to Socket.IO server.
      //
      // NOTE: On Windows + Werkzeug, WebSocket upgrade can be flaky and produce
      // "Invalid frame header". To eliminate that console spam and disconnect loop
      // we use polling-only transport here (still real-time enough for UI streaming).
      this.socket = io(this.wsBaseUrl, {
        auth: token ? { token } : {},
        transports: ['polling'],
        upgrade: false,
        forceNew: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 20000
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        callbacks.onConnected?.();

        // Subscribe to detection updates
        if (this.socket) {
          this.socket.emit('subscribe_detection', {});
        }
      });

      this.socket.on('connected', (data: any) => {
        console.log('WebSocket server confirmed connection:', data);
      });

      this.socket.on('subscribed', (data: any) => {
        console.log('✅ Subscribed to detection updates:', data);
      });

      this.socket.on('detection_frame', (data: { frame: string; status: DetectionStatus; ready: boolean }) => {
        // Real-time frame update via WebSocket
        if (data.frame && data.ready) {
          callbacks.onFrame?.(data);
        }
      });

      this.socket.on('detection_status', (status: DetectionStatus) => {
        callbacks.onStatus?.(status);
      });

      this.socket.on('error', (error: any) => {
        console.error('WebSocket error:', error);
        callbacks.onError?.(new Error(error.message || 'WebSocket error'));
      });

      this.socket.on('disconnect', (reason: string) => {
        console.log('WebSocket disconnected:', reason);
        this.isConnected = false;
        callbacks.onDisconnected?.();
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('WebSocket connection error:', error);
        callbacks.onError?.(new Error('Failed to connect to WebSocket server'));
      });

    } catch (error: any) {
      console.error('WebSocket setup error:', error);
      callbacks.onError?.(error);
    }
  }

  disconnectWebSocket(): void {
    if (this.socket) {
      try {
        if (this.socket.connected) {
          this.socket.emit('unsubscribe_detection', {});
        }
        this.socket.disconnect();
        console.log('WebSocket disconnected');
      } catch (error) {
        console.error('Error disconnecting WebSocket:', error);
      }
      this.socket = null;
      this.isConnected = false;
    }
  }

  isWebSocketConnected(): boolean {
    return this.isConnected && (this.socket?.connected === true);
  }
}

export const detectionClient = new DetectionClient();

