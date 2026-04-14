'use client';

import { File, ListFilter, PlusCircle, Download, CheckCircle2, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { apiClient, Event } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { AlertCircle, Car, Package, User, Video, Camera } from "lucide-react";
import { AdvancedSearch } from "@/components/advanced-search";
import { EventSummary } from "@/components/event-summary";
import { cn } from "@/lib/utils";
import { MessageLoading } from "@/components/ui/message-loading";

const eventIcons: Record<string, any> = {
  person: User,
  car: Car,
  package: Package,
  anomaly: AlertCircle,
  manual_recording: Video,
  manual_snapshot: Camera,
};

function getEventTitle(event: Event) {
  const meta: any = event.metadata || {};
  if (event.detectionType === "person") {
    const tid = typeof meta.trackId === "number" ? meta.trackId : undefined;
    const idPart = tid !== undefined ? ` #${tid}` : "";
    const eventType = meta.eventType as string | undefined;
    if (eventType === "entered") return `Person${idPart} Entered`;
    if (eventType === "left") return `Person${idPart} Left`;
    if (eventType === "loitering") return `Person${idPart} Loitering`;
    return `Person${idPart}`;
  }
  if (event.detectionType === "anomaly") return "Anomaly";
  if (event.detectionType === "manual_recording") return "Manual Recording";
  if (event.detectionType === "manual_snapshot") return "Manual Snapshot";
  if (event.objects?.length) return event.objects.join(", ");
  return "Detection";
}

function getEventSubtitle(event: Event) {
  const meta: any = event.metadata || {};
  if (event.detectionType === "person") {
    const eventType = meta.eventType as string | undefined;
    if (eventType === "left" && meta.dwellSeconds) return `Dwell: ${meta.dwellSeconds}s`;
    if (eventType === "loitering" && meta.dwellSeconds) return `Dwell: ${meta.dwellSeconds}s (threshold ${meta.thresholdSeconds || 120}s)`;
  }
  if (event.detectionType === "anomaly" && meta.anomalyScore !== undefined) {
    return `Score: ${meta.anomalyScore}`;
  }
  return "";
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [isExportMode, setIsExportMode] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadEvents();
  }, [filterType]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getEvents({
        type: filterType === 'all' ? undefined : filterType,
        limit: 100,
      });
      // Filter to only show events with media or anomalies
      const validEvents = response.events.filter((e: Event) => 
        e.snapshotUrl || 
        e.videoUrl || 
        e.imageUrl ||
        e.detectionType === 'anomaly' || 
        e.detectionType === 'manual_recording' || 
        e.detectionType === 'manual_snapshot'
      );
      setEvents(validEvents);
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

  const getEventIcon = (event: Event) => {
    if (event.detectionType === 'anomaly') return AlertCircle;
    if (event.detectionType === 'manual_recording') return Video;
    if (event.detectionType === 'manual_snapshot') return Camera;
    if (event.objects.length > 0) {
      const firstObject = event.objects[0].toLowerCase();
      return eventIcons[firstObject] || AlertCircle;
    }
    return AlertCircle;
  };

  const handleSearchResults = (searchResults: Event[]) => {
    setEvents(searchResults);
  };

  const handleToggleSelect = (id: string, checked: boolean) => {
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEventIds(new Set(events.map(e => e._id)));
    } else {
      setSelectedEventIds(new Set());
    }
  };

  const handleExport = async () => {
    if (selectedEventIds.size === 0) {
      toast({
        title: "No events selected",
        description: "Please select at least one event to export.",
        variant: "destructive",
      });
      return;
    }

    const selectedEvents = events.filter(e => selectedEventIds.has(e._id));
    let successCount = 0;
    
    setExporting(true);
    toast({
      title: "Exporting data...",
      description: `Preparing your downloads for ${selectedEvents.length} items.`,
    });

    try {
      for (const event of selectedEvents) {
        const url = event.videoUrl || event.snapshotUrl || event.imageUrl;
        if (!url) continue;

        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error("Fetch failed");
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          
          const link = document.createElement("a");
          link.href = blobUrl;
          
          const timestamp = format(new Date(event.timestamp), "yyyyMMdd_HHmmss");
          const titleSnippet = getEventTitle(event).replace(/\s+/g, '_').toLowerCase().substring(0, 20);
          const fileName = `export_${titleSnippet}_${timestamp}${event.videoUrl ? '.mp4' : '.jpg'}`;
          
          link.setAttribute("download", fileName);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(blobUrl);
          successCount++;
        } catch (error) {
          console.error("Failed to download", url, error);
        }
      }

      if (successCount > 0) {
        toast({
          title: "Export Complete",
          description: `Successfully downloaded ${successCount} ${successCount === 1 ? 'file' : 'files'}.`,
        });
        setIsExportMode(false);
        setSelectedEventIds(new Set());
      } else {
        toast({
          title: "Export Failed",
          description: "Could not download any selected files.",
          variant: "destructive",
        });
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Tabs 
            value={filterType === 'all' ? 'all' : (filterType === 'object' ? 'objects' : 'anomalies')}
            onValueChange={(v) => {
              if (v === 'all') setFilterType('all');
              if (v === 'objects') setFilterType('object');
              if (v === 'anomalies') setFilterType('anomaly');
            }}
          >
            <div className="flex items-center mb-4">
              <TabsList>
                <TabsTrigger value="all">
                  All
                </TabsTrigger>
                <TabsTrigger value="objects">
                  Objects
                </TabsTrigger>
                <TabsTrigger value="anomalies">
                  Anomalies
                </TabsTrigger>
              </TabsList>
              <div className="ml-auto flex items-center gap-2">
                {isExportMode && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 px-2" 
                    onClick={() => {
                      setIsExportMode(false);
                      setSelectedEventIds(new Set());
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant={isExportMode ? "default" : "outline"} 
                  className={cn("h-8 gap-1 transition-all", isExportMode && selectedEventIds.size > 0 && "bg-primary text-primary-foreground shadow-md scale-105")}
                  onClick={isExportMode ? handleExport : () => setIsExportMode(true)}
                  disabled={isExportMode && selectedEventIds.size === 0 || exporting}
                >
                  {exporting ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>Exporting...</span>
                    </>
                  ) : isExportMode ? (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      <span>Download {selectedEventIds.size > 0 ? `(${selectedEventIds.size})` : ""}</span>
                    </>
                  ) : (
                    <>
                      <File className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Export
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Tabs>
              <Card>
                <CardHeader>
                  <CardTitle>Event History</CardTitle>
                  <CardDescription>
                    A log of all detected events from your cameras.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <MessageLoading />
                      <p className="text-sm text-muted-foreground animate-pulse">Fetching events...</p>
                    </div>
                  ) : events.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No events found. Start monitoring to see detection events here.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {isExportMode && (
                            <TableHead className="w-[40px] px-2 text-center">
                              <Checkbox 
                                checked={selectedEventIds.size === events.length && events.length > 0}
                                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                aria-label="Select all"
                              />
                            </TableHead>
                          )}
                          <TableHead className="hidden w-[100px] sm:table-cell">
                            <span className="sr-only">Image</span>
                          </TableHead>
                          <TableHead>Event Type</TableHead>
                          <TableHead>Anomaly Score</TableHead>
                          <TableHead className="hidden md:table-cell">
                            Camera
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            Timestamp
                          </TableHead>
                          <TableHead>
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.map((event) => {
                          const EventIcon = getEventIcon(event);
                          const anomalyScore = event.detectionType === "anomaly" && event.metadata?.anomalyScore
                            ? Math.round(event.metadata.anomalyScore * 100)
                            : null;
                          const anomalyColor =
                            (anomalyScore ?? 0) > 80
                              ? "text-destructive"
                              : (anomalyScore ?? 0) > 50
                                ? "text-yellow-500"
                                : "text-green-500";

                          return (
                            <TableRow key={event._id} className={cn("group transition-colors relative", (anomalyScore ?? 0) > 80 && "bg-destructive/5 hover:bg-destructive/10", isExportMode && selectedEventIds.has(event._id) && "bg-primary/5")}>
                              {isExportMode && (
                                <TableCell className="w-[40px] px-2 text-center">
                                  <Checkbox 
                                    checked={selectedEventIds.has(event._id)}
                                    onCheckedChange={(checked) => handleToggleSelect(event._id, !!checked)}
                                    aria-label={`Select event ${event._id}`}
                                  />
                                </TableCell>
                              )}
                              <TableCell className="hidden sm:table-cell py-3">
                                {event.snapshotUrl || event.imageUrl ? (
                                  <div className="relative h-14 w-14 group/img">
                                    <Image
                                      alt="Event thumbnail"
                                      className="aspect-square rounded-md object-cover ring-1 ring-border/50 group-hover/img:ring-primary transition-all cursor-crosshair delay-100"
                                      fill
                                      sizes="(max-width: 640px) 100vw, 150px"
                                      src={event.snapshotUrl || event.imageUrl || ''}
                                    />
                                    {/* Enlarge on hover */}
                                    <div className="absolute z-[100] left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/img:opacity-100 pointer-events-none transition-all duration-300 scale-95 group-hover/img:scale-100 origin-left hidden md:block">
                                      <div className="relative h-48 w-72 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-border bg-black">
                                        <Image
                                          alt="Event thumbnail enlarged"
                                          className="object-cover"
                                          fill
                                          sizes="300px"
                                          src={event.snapshotUrl || event.imageUrl || ''}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="aspect-square rounded-md bg-muted flex items-center justify-center relative h-14 w-14 border border-border/50">
                                    <EventIcon className={cn("h-6 w-6", event.videoUrl ? "text-primary animate-pulse" : "text-muted-foreground")} />
                                    {event.detectionType === "person" && typeof (event.metadata as any)?.trackId === "number" && (
                                      <div className="absolute bottom-1 right-1 text-[10px] font-semibold bg-background/80 border rounded px-1">
                                        #{(event.metadata as any).trackId}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <EventIcon className="h-4 w-4 text-muted-foreground" />
                                  <div className="flex flex-col">
                                    <span>{getEventTitle(event)}</span>
                                    {getEventSubtitle(event) && (
                                      <span className="text-xs text-muted-foreground">{getEventSubtitle(event)}</span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {anomalyScore === null ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : (
                                  <Badge
                                    variant={anomalyScore > 80 ? "destructive" : "outline"}
                                    className={anomalyColor}
                                  >
                                    {anomalyScore}%
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {event.location}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {format(new Date(event.timestamp), "PPP p")}
                              </TableCell>
                              <TableCell>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm">View Details</Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>Event Details</DialogTitle>
                                      <DialogDescription className="sr-only">
                                        View the detailed information and snapshot of this detection event.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <EventSummary event={event} />
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
                <CardFooter>
                  <div className="text-xs text-muted-foreground">
                    Showing <strong>1-{events.length}</strong> of <strong>{events.length}</strong>{" "}
                    events
                  </div>
                </CardFooter>
              </Card>
        </div>
        <div className="space-y-4">
          <AdvancedSearch onResults={handleSearchResults} />
        </div>
      </div>
    </div>
  );
}
