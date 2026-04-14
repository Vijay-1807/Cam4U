/**
 * API Client for backend communication
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  settings?: any;
  notificationPrefs?: any;
  anomalyRules?: string[];
}

export interface Event {
  _id: string;
  userId: string;
  detectionType: string;
  objects: string[];
  confidence: number;
  fps: number;
  frameCount: number;
  location: string;
  snapshotUrl?: string;
  videoUrl?: string;
  timestamp: string;
  metadata?: Record<string, any>;
  imageUrl?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Camera {
  _id: string;
  userId: string;
  name: string;
  url: string;
  location: string;
  type: string;
  index: number;
  status: string;
  thumbnailUrlId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventsResponse {
  events: Event[];
  total: number;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Load token from localStorage
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (error: any) {
      // Network error - backend is not running
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error(
          `Backend server is not running. Please start the backend server:\n` +
          `1. Open terminal in the 'backend' folder\n` +
          `2. Run: python api_server.py\n` +
          `3. Make sure it's running on ${this.baseUrl.replace('/api', '')}`
        );
      }
      throw error;
    }

    // Check if response is HTML (error page) instead of JSON
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/json')) {
      const text = await response.text();
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        throw new Error(
          `Backend server returned HTML instead of JSON. This usually means:\n` +
          `1. Backend is not running - Start it with: python api_server.py\n` +
          `2. Wrong API URL - Check NEXT_PUBLIC_API_URL in .env.local\n` +
          `3. Backend error - Check backend terminal for errors\n` +
          `Current API URL: ${this.baseUrl}`
        );
      }
    }

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch {
        // If JSON parsing fails, try to get text
        const text = await response.text();
        if (text) {
          errorMessage = text.substring(0, 200); // Limit length
        }
      }
      throw new Error(errorMessage);
    }

    try {
      return await response.json();
    } catch (error: any) {
      // If JSON parsing fails, it might be HTML
      const text = await response.text();
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        throw new Error(
          `Backend returned HTML instead of JSON. Backend may not be running.\n` +
          `Please start the backend: python api_server.py\n` +
          `API URL: ${this.baseUrl}`
        );
      }
      throw new Error(`Invalid JSON response: ${error.message}`);
    }
  }

  // Authentication methods
  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async updateCurrentUser(data: Partial<User>): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateFcmToken(token: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/fcm-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  // Events methods
  async getEvents(params?: {
    type?: string;
    limit?: number;
    skip?: number;
  }): Promise<EventsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.skip) queryParams.append('skip', params.skip.toString());

    const endpoint = `/events${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.request<EventsResponse>(endpoint);
  }

  async getEvent(eventId: string): Promise<Event> {
    return this.request<Event>(`/events/${eventId}`);
  }

  async clearAllEvents(): Promise<{ message: string, count: number }> {
    return this.request<{ message: string, count: number }>('/events/all', {
      method: 'DELETE',
    });
  }

  async suggestRules(location: string): Promise<{ rules: string[] }> {
    return this.request<{ rules: string[] }>('/ai/suggest-rules', {
      method: 'POST',
      body: JSON.stringify({ location }),
    });
  }

  async createEvent(data: {
    detectionType: string;
    objects?: string[];
    confidence?: number;
    fps?: number;
    frameCount?: number;
    location?: string;
    metadata?: Record<string, any>;
    imagePath?: string;
    videoPath?: string;
  }): Promise<{ id: string; message: string }> {
    return this.request<{ id: string; message: string }>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteEvent(eventId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/events/${eventId}`, {
      method: 'DELETE',
    });
  }

  // Camera Management methods
  async getCameras(): Promise<Camera[]> {
    return this.request<Camera[]>('/cameras');
  }

  async addCamera(data: {
    name: string;
    url: string;
    location?: string;
    type?: string;
    index?: number;
  }): Promise<Camera> {
    return this.request<Camera>('/cameras', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCamera(cameraId: string, data: Partial<Camera>): Promise<Camera> {
    return this.request<Camera>(`/cameras/${cameraId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCamera(cameraId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/cameras/${cameraId}`, {
      method: 'DELETE',
    });
  }

  // Statistics methods
  async getStats(): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
  }> {
    return this.request('/stats');
  }

  async generateReport(type: 'daily' | 'weekly' | 'monthly'): Promise<{ report: string }> {
    return this.request<{ report: string }>(`/reports/generate?type=${type}`, {
      method: 'POST'
    });
  }

  // Health check
  async healthCheck(): Promise<{
    status: string;
    mongodb: string;
    cloudinary: string;
    openrouter?: string;
  }> {
    return this.request('/health');
  }

  // AI/OpenRouter methods
  async aiChat(message: string): Promise<{ response: string }> {
    return this.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  // Advanced search
  async searchEvents(filters: {
    objects?: string[];
    startDate?: string;
    endDate?: string;
    location?: string;
    detectionType?: string;
    minConfidence?: number;
  }): Promise<EventsResponse> {
    return this.request<EventsResponse>('/events/search', {
      method: 'POST',
      body: JSON.stringify(filters),
    });
  }

  async uploadMedia(file: Blob, type: 'image' | 'video'): Promise<{ url: string; public_id: string }> {
    const formData = new FormData();
    // Append file. Name it 'file' as expected by backend.
    // Filename 'upload.webm' or 'upload.jpg' helps backend detect mime type if needed, 
    // though we use 'type' param too.
    const filename = type === 'video' ? 'upload.webm' : 'upload.jpg';
    formData.append('file', file, filename);
    formData.append('type', type);

    // Use raw fetch to handle FormData (ApiClient.request sets JSON headers which we don't want here)
    const url = `${this.baseUrl}/upload`;
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Upload failed: ${response.statusText}`);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();

