'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient, Event } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { Activity, AlertTriangle, Camera, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyticsData {
  totalEvents: number;
  anomalies: number;
  byObject: Record<string, number>;
  byLocation: Record<string, number>;
  byHour: Record<string, number>;
  anomaliesByHour: Record<string, number>;
  byDay: Record<string, number>;
}

export function AnalyticsDashboard({ events }: { events: Event[] }) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    if (events.length === 0) {
      setAnalytics({
        totalEvents: 0,
        anomalies: 0,
        byObject: {},
        byLocation: {},
        byHour: {},
        anomaliesByHour: {},
        byDay: {},
      });
      return;
    }

    const data: AnalyticsData = {
      totalEvents: events.length,
      anomalies: events.filter((e) => e.detectionType === 'anomaly').length,
      byObject: {},
      byLocation: {},
      byHour: {},
      anomaliesByHour: {},
      byDay: {},
    };

    events.forEach((event) => {
      // Count objects
      event.objects.forEach((obj) => {
        data.byObject[obj] = (data.byObject[obj] || 0) + 1;
      });

      // Count by location
      const location = event.location || 'Unknown';
      data.byLocation[location] = (data.byLocation[location] || 0) + 1;

      // Count by hour
      const date = new Date(event.timestamp);
      const hour = date.getHours();
      data.byHour[hour] = (data.byHour[hour] || 0) + 1;
      if (event.detectionType === 'anomaly') {
        data.anomaliesByHour[hour] = (data.anomaliesByHour[hour] || 0) + 1;
      }

      // Count by day
      const day = date.toLocaleDateString('en-US', { weekday: 'short' });
      data.byDay[day] = (data.byDay[day] || 0) + 1;
    });

    setAnalytics(data);
  }, [events]);

  if (!analytics) {
    return <div className="animate-pulse h-64 bg-muted/20 rounded-xl"></div>;
  }

  const objectChartData = Object.entries(analytics.byObject)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  const locationChartData = Object.entries(analytics.byLocation)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([name, value]) => ({ name, value }));

  const hourChartData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    events: analytics.byHour[i] || 0,
    anomalies: analytics.anomaliesByHour[i] || 0,
  }));

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted-foreground))', 'hsl(var(--secondary-foreground))', 'hsl(var(--accent-foreground))'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:auto-rows-[minmax(120px,auto)]">

      {/* KPI 1: Anomalies (Destructive Box) */}
      <Card className="md:col-span-2 row-span-1 bg-destructive text-destructive-foreground border-0 shadow-lg relative overflow-hidden group">
        <div className="absolute right-0 top-0 opacity-10 blur-2xl transform translate-x-1/2 -translate-y-1/2">
          <AlertTriangle className="h-48 w-48" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium tracking-wider uppercase opacity-90">Critical Anomalies</CardTitle>
          <AlertTriangle className="h-5 w-5 opacity-90" />
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-4xl sm:text-5xl font-black tracking-tighter">{analytics.anomalies}</div>
          <p className="text-sm opacity-80 mt-1 font-medium">
            {analytics.totalEvents > 0
              ? ((analytics.anomalies / analytics.totalEvents) * 100).toFixed(1)
              : 0}% of total events
          </p>
        </CardContent>
      </Card>

      {/* KPI 2: Total Events (Primary Black/White Box) */}
      <Card className="md:col-span-1 row-span-1 bg-primary text-primary-foreground border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium tracking-wider uppercase opacity-90">Total Events</CardTitle>
          <Activity className="h-4 w-4 opacity-90" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl sm:text-4xl font-black tracking-tighter">{analytics.totalEvents}</div>
          <p className="text-xs opacity-70 mt-1">Recorded past 24h</p>
        </CardContent>
      </Card>

      {/* KPI 3: Cameras */}
      <Card className="md:col-span-1 row-span-1 border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium tracking-wider uppercase text-muted-foreground">Locations</CardTitle>
          <Camera className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl sm:text-4xl font-black tracking-tighter">{Object.keys(analytics.byLocation).length}</div>
          <p className="text-xs text-muted-foreground mt-1">Active feeds</p>
        </CardContent>
      </Card>

      {/* Main Chart: Timeline Area Chart */}
      <Card className="md:col-span-3 row-span-2 border-border/50 shadow-sm flex flex-col">
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <p className="text-sm text-muted-foreground">Event frequency and anomaly spikes over the day.</p>
        </CardHeader>
        <CardContent className="flex-1 min-h-[250px] pb-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAnomalies" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontSize: '13px', fontWeight: 600 }}
                labelStyle={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
              />
              <Area type="monotone" dataKey="events" name="Total Events" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorEvents)" activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(var(--primary))' }} />
              <Area type="monotone" dataKey="anomalies" name="Anomalies" stroke="hsl(var(--destructive))" strokeWidth={2} fillOpacity={1} fill="url(#colorAnomalies)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Side Chart: Topology/Locations */}
      <Card className="md:col-span-1 row-span-2 border-border/50 shadow-sm flex flex-col">
        <CardHeader>
          <CardTitle>Hotspots</CardTitle>
          <p className="text-sm text-muted-foreground">Activity by location</p>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center min-h-[250px]">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={locationChartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                stroke="hsl(var(--background))"
                strokeWidth={2}
                paddingAngle={2}
                dataKey="value"
              >
                {locationChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: 'hsl(var(--foreground))', color: 'hsl(var(--background))' }}
                itemStyle={{ color: 'hsl(var(--background))' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="w-full mt-4 space-y-2">
            {locationChartData.slice(0, 3).map((loc, i) => (
              <div key={loc.name} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  <span className="truncate max-w-[100px]">{loc.name}</span>
                </div>
                <span className="font-mono font-medium">{loc.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bottom Chart: Objects */}
      <Card className="md:col-span-4 row-span-1 border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            Detected Objects
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={objectChartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} width={80} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
              />
              <Bar dataKey="value" name="Detections" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

    </div>
  );
}

