'use client';

import { useEffect, useState } from 'react';
import { apiClient, Event } from '@/lib/api';
import { AnalyticsDashboard } from '@/components/analytics-dashboard';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageLoading } from '@/components/ui/message-loading';

export default function AnalyticsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getEvents({ limit: 1000 });
        setEvents(response.events);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load events',
          variant: 'destructive',
          });
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] gap-4">
        <MessageLoading />
        <p className="text-sm text-muted-foreground animate-pulse tracking-wide">
          Analyzing data patterns...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Insights and statistics from your detection events
        </p>
      </div>
      <AnalyticsDashboard events={events} />
    </div>
  );
}

