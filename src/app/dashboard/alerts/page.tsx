'use client';

import {
  Check,
  ChevronRight,
  Play,
  Camera,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useAlerts } from '@/contexts/AlertsContext';

const severityConfig = {
  critical: {
    badge: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold tracking-wide shadow-sm',
    icon: 'text-destructive',
    dot: 'bg-destructive animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]',
  },
  warning: {
    badge: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30 font-medium',
    icon: 'text-yellow-500',
    dot: 'bg-yellow-500',
  },
  info: {
    badge: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 font-medium',
    icon: 'text-blue-500',
    dot: 'bg-blue-500',
  },
};

export default function AlertsPage() {
  const { alerts, markAllAsRead, markOneAsRead } = useAlerts();
  const [activeTab, setActiveTab] = useState('all');
  const [selectedAlert, setSelectedAlert] = useState<typeof alerts[0] | null>(null);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (activeTab === 'all') return true;
      return alert.severity === activeTab;
    });
  }, [alerts, activeTab]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Alerts</h1>
        <Button variant="outline" onClick={markAllAsRead} className="w-full sm:w-auto">
          <Check className="mr-2 h-4 w-4" />
          Mark all as read
        </Button>
      </div>

      <Tabs defaultValue="all" onValueChange={setActiveTab} className='flex-grow flex flex-col'>
        <TabsList className="self-start w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="critical">Critical</TabsTrigger>
          <TabsTrigger value="warning">Warning</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6 flex-grow">
          <Card className="h-full">
            <CardContent className="p-0">
              <div className="relative py-6 px-4">
                {/* Vertical Timeline Divider */}
                <div className="absolute left-9 top-0 bottom-0 w-px bg-border/80 hidden sm:block"></div>

                {filteredAlerts.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No alerts found.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={cn(
                          "group flex items-start gap-3 sm:gap-6 p-4 sm:p-5 transition-all duration-300 cursor-pointer relative rounded-2xl border",
                          alert.severity === 'critical' && !alert.read ? "bg-destructive/5 hover:bg-destructive/10 border-destructive/30 hover:border-destructive/60 shadow-[0_0_15px_rgba(239,68,68,0.05)]" :
                            alert.read ? "bg-background border-transparent hover:border-border" : "bg-muted/10 hover:bg-muted/30 border-border/40 hover:border-border"
                        )}
                        onClick={() => markOneAsRead(alert.id)}
                      >
                        <div className="relative z-10 flex flex-col items-center justify-center pt-1.5 hidden sm:flex">
                          <div className={cn("h-3 w-3 rounded-full flex-shrink-0 transition-all ring-4 ring-background", alert.read ? 'bg-muted-foreground/40' : severityConfig[alert.severity].dot)}></div>
                        </div>
                        <div className="flex-grow min-w-0 relative">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <alert.Icon className={cn("h-4 w-4 sm:hidden flex-shrink-0", severityConfig[alert.severity].icon)} />
                                <p className={cn("font-bold text-sm sm:text-base", !alert.read ? "text-foreground" : "text-muted-foreground")}>{alert.title}</p>
                              </div>
                              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{alert.description}</p>
                            </div>
                            {(alert.imageUrl || alert.videoUrl) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="ml-2 h-8 text-xs shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAlert(alert);
                                  markOneAsRead(alert.id);
                                }}
                              >
                                {alert.videoUrl ? <Play className="h-3 w-3 mr-1" /> : <Camera className="h-3 w-3 mr-1" />}
                                View
                              </Button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="secondary" className={cn("capitalize text-xs", severityConfig[alert.severity].badge)}>{alert.severity}</Badge>
                            <Badge variant="outline" className="text-xs">{alert.camera}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-2 md:hidden">
                            {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                          </div>
                        </div>

                        {/* Hover Reveal Thumbnail */}
                        {(alert.imageUrl || alert.videoUrl) && (
                          <div className="absolute right-36 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-3 group-hover:translate-x-0 pointer-events-none hidden md:block">
                            {alert.imageUrl ? (
                              <img src={alert.imageUrl} alt="Preview" className="h-16 w-24 object-cover rounded-md shadow-xl border border-border" />
                            ) : (
                              <div className="h-16 w-24 bg-muted/80 backdrop-blur-sm rounded-md flex items-center justify-center border border-border shadow-xl">
                                <Play className="h-6 w-6 text-foreground" />
                              </div>
                            )}
                          </div>
                        )}

                        <div className="text-right text-sm text-muted-foreground hidden md:block flex-shrink-0 transition-opacity duration-300 group-hover:opacity-40 font-medium">
                          {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedAlert?.title}</DialogTitle>
            <DialogDescription>
              {selectedAlert && formatDistanceToNow(new Date(selectedAlert.timestamp), { addSuffix: true })} - {selectedAlert?.camera}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-4">
            {selectedAlert?.videoUrl ? (
              <video
                src={selectedAlert.videoUrl}
                controls
                autoPlay
                className="w-full rounded-lg border bg-black aspect-video"
              />
            ) : selectedAlert?.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedAlert.imageUrl}
                  alt="Evidence"
                  className="w-full rounded-lg border bg-muted object-contain max-h-[60vh]"
                />
              </>
            ) : (
              <div className="p-8 text-center text-muted-foreground bg-muted rounded-lg">
                No media content available.
              </div>
            )}
            <p className="text-sm text-muted-foreground">{selectedAlert?.description}</p>

            {/* Detailed Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg border">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Camera</p>
                <p className="text-sm font-medium">{selectedAlert?.camera}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Timestamp</p>
                <p className="text-sm font-medium">
                  {selectedAlert && new Date(selectedAlert.timestamp).toLocaleString()}
                </p>
              </div>

              {selectedAlert?.confidence !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Confidence</p>
                  <p className="text-sm font-medium">
                    {(selectedAlert.confidence * 100).toFixed(1)}%
                  </p>
                </div>
              )}

              {selectedAlert?.fps !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium">FPS</p>
                  <p className="text-sm font-medium">{selectedAlert.fps.toFixed(1)}</p>
                </div>
              )}

              {/* Dynamic Metadata Fields */}
              {selectedAlert?.metadata && Object.entries(selectedAlert.metadata).map(([key, value]) => {
                // Skip internal or already displayed fields
                if (['eventType', 'trackId', 'threatType', 'priority'].includes(key)) return null;
                if (typeof value === 'object') return null;

                // Format key: camelCase to Title Case
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

                // Format timestamps (Entered At, Left At)
                let displayValue = String(value);
                if (key === 'enteredAt' || key === 'leftAt') {
                  const numVal = Number(value);
                  if (!isNaN(numVal)) {
                    try {
                      // Backend sends seconds, TS needs milliseconds
                      displayValue = new Date(numVal * 1000).toLocaleString();
                    } catch (e) {
                      // keep original on error
                    }
                  }
                }

                return (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground font-medium">{label}</p>
                    <p className="text-sm font-medium">{displayValue}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}