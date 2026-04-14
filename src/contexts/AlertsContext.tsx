'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { apiClient, Event } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Bell, ShieldAlert, Camera, Video } from 'lucide-react';

// --- Types ---
export type Alert = {
    id: string;
    read: boolean;
    title: string;
    description: string;
    timestamp: string;
    severity: 'critical' | 'warning' | 'info';
    camera: string;
    Icon: React.ElementType;
    imageUrl?: string;
    videoUrl?: string;
    fps?: number;
    confidence?: number;
    metadata?: Record<string, any>;
};

type AlertsContextType = {
    alerts: Alert[];
    unreadCount: number;
    loading: boolean;
    markAllAsRead: () => void;
    markOneAsRead: (id: string) => void;
    refreshAlerts: () => void;
};

// --- Constants & Helpers ---
const READ_ALERT_IDS_KEY = 'read_alert_ids_v1';

function loadReadIds(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const raw = localStorage.getItem(READ_ALERT_IDS_KEY);
        if (!raw) return new Set();
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr.map(String));
    } catch {
        return new Set();
    }
}

function saveReadIds(ids: Set<string>) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(READ_ALERT_IDS_KEY, JSON.stringify(Array.from(ids)));
    } catch {
        // ignore
    }
}

function eventToAlert(event: Event): Alert {
    const meta = event.metadata || {};
    const eventType = meta.eventType as string | undefined;
    const trackId = meta.trackId as number | undefined;

    let severity: Alert['severity'] = 'info';
    let Icon: React.ElementType = AlertCircle;

    if (event.detectionType === 'anomaly') {
        severity = 'critical';
        Icon = ShieldAlert;
    } else if (event.detectionType === 'threat') {
        severity = 'critical';
        Icon = ShieldAlert;
    } else if (event.detectionType === 'person' && eventType === 'loitering') {
        severity = 'warning';
        Icon = Bell;
    } else if (event.detectionType === 'person' && eventType === 'left') {
        severity = 'info';
        Icon = AlertCircle;
    } else if (event.detectionType === 'person' && eventType === 'entered') {
        severity = 'info';
        Icon = AlertCircle;
    }

    let title = 'Alert';
    let description = 'An event was detected.';

    if (event.detectionType === 'anomaly') {
        title = 'Critical Anomaly Detected';
        description = `Anomaly detected on ${event.location}.`;
    } else if (event.detectionType === 'threat') {
        const threatType = meta.threatType || 'Weapon';
        // Capitalize first letter
        const formattedThreat = String(threatType).charAt(0).toUpperCase() + String(threatType).slice(1);
        title = `${formattedThreat} Detected`;
        description = `Security Alert: ${formattedThreat} detected on ${event.location}. CHECK IMMEDIATELY.`;
    } else if (event.detectionType === 'manual_snapshot') {
        title = 'Manual Snapshot';
        description = `Snapshot taken on ${event.location}.`;
        Icon = Camera;
    } else if (event.detectionType === 'manual_recording') {
        title = 'Manual Recording';
        description = `Video recorded on ${event.location}.`;
        Icon = Video;
    } else if (event.detectionType === 'person') {
        const idPart = typeof trackId === 'number' ? ` #${trackId}` : '';
        if (eventType === 'entered') {
            title = `Person${idPart} Entered`;
            description = `Person${idPart} entered on ${event.location}.`;
        } else if (eventType === 'left') {
            title = `Person${idPart} Left`;
            const dwell = meta.dwellSeconds ? ` Dwell: ${meta.dwellSeconds}s.` : '';
            description = `Person${idPart} left on ${event.location}.${dwell}`;
        } else if (eventType === 'loitering') {
            title = `Person${idPart} Loitering`;
            const dwell = meta.dwellSeconds ? ` Dwell: ${meta.dwellSeconds}s.` : '';
            description = `Loitering detected for person${idPart} on ${event.location}.${dwell}`;
        } else {
            title = 'Person Detected';
            description = `Person detected on ${event.location}.`;
        }
    }

    return {
        id: event._id,
        read: false, // Default, will be overwritten by context logic
        title,
        description,
        timestamp: event.timestamp,
        severity,
        camera: event.location,
        Icon,
        imageUrl: event.imageUrl || event.snapshotUrl, // Handle both potential field names
        videoUrl: event.videoUrl,
        fps: event.fps,
        confidence: event.confidence,
        metadata: meta
    };
}

// --- Context ---
const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export function AlertsProvider({ children }: { children: React.ReactNode }) {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchAlerts = useCallback(async () => {
        try {
            // Fetch latest events
            const res = await apiClient.getEvents({ limit: 100 });
            const readIds = loadReadIds();

            // Filter high-signal alerts
            const filteredEvents = res.events.filter((e) => {
                if (e.detectionType === 'threat') return true;
                if (e.detectionType === 'anomaly') return true;
                if (e.detectionType === 'manual_snapshot') return true;
                if (e.detectionType === 'manual_recording') return true;
                if (e.detectionType !== 'person') return false;
                const eventType = (e.metadata as any)?.eventType;
                return eventType === 'loitering' || eventType === 'left' || eventType === 'entered';
            });

            const mappedAlerts = filteredEvents
                .map(eventToAlert)
                .map((a) => ({ ...a, read: readIds.has(a.id) }))
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            setAlerts(mappedAlerts);
        } catch (e: any) {
            console.error("Failed to fetch alerts:", e);
            // We explicitly don't toast on polling errors to avoid spamming the user
            // unless it's the initial load.
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load + Polling
    useEffect(() => {
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, [fetchAlerts]);

    const markAllAsRead = useCallback(() => {
        setAlerts((prev) => {
            const next = prev.map((a) => ({ ...a, read: true }));
            const readIds = loadReadIds();
            for (const a of next) readIds.add(a.id);
            saveReadIds(readIds);
            return next;
        });
    }, []);

    const markOneAsRead = useCallback((id: string) => {
        setAlerts((prev) => {
            const next = prev.map((a) => (a.id === id ? { ...a, read: true } : a));
            const readIds = loadReadIds();
            readIds.add(id);
            saveReadIds(readIds);
            return next;
        });
    }, []);

    const unreadCount = useMemo(() => {
        return alerts.filter((a) => !a.read).length;
    }, [alerts]);

    const value = {
        alerts,
        unreadCount,
        loading,
        markAllAsRead,
        markOneAsRead,
        refreshAlerts: fetchAlerts,
    };

    return (
        <AlertsContext.Provider value={value}>
            {children}
        </AlertsContext.Provider>
    );
}

export function useAlerts() {
    const context = useContext(AlertsContext);
    if (context === undefined) {
        throw new Error('useAlerts must be used within an AlertsProvider');
    }
    return context;
}
