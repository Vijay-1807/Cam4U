'use client';

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Camera as CameraIcon,
  Video,
} from "lucide-react";
import { MessageLoading } from "@/components/ui/message-loading";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { alerts } from "@/lib/data";
import Link from "next/link";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { apiClient, Event, Camera } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { CameraFeed } from "@/components/camera-feed";

export default function Dashboard() {
  const [stats, setStats] = useState({ totalEvents: 0, byType: {} as Record<string, number> });
  const [loading, setLoading] = useState(true);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<
    { id: string; title: string; severity: "Critical" | "High" | "Medium"; timestamp: string }[]
  >([]);
  const { toast } = useToast();
  const router = useRouter();

  const onlineCameras = cameras.filter((c) => c.status === "Online").length;

  useEffect(() => {
    loadStats();
    loadRecentAlerts();
    loadCameras();
  }, []);

  const loadCameras = async () => {
    try {
      const data = await apiClient.getCameras();
      setCameras(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      const statsData = await apiClient.getStats();
      setStats(statsData);
    } catch (error: any) {
      const message = error.message || "Failed to load statistics";

      // If auth failed (expired/missing token), clear auth and send user to login
      if (message.toLowerCase().includes("token has expired") || message.toLowerCase().includes("token is missing") || message.toLowerCase().includes("unauthorized")) {
        apiClient.clearToken();
        toast({
          title: "Session expired",
          description: "Please sign in again to continue.",
          variant: "destructive",
        });
        router.push("/login");
        return;
      }

      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const anomalyCount = stats.byType?.anomaly || 0;
  const totalEventsToday = stats.totalEvents || 0;

  const loadRecentAlerts = async () => {
    try {
      const res = await apiClient.getEvents({ limit: 50 });
      const alerts = res.events
        .filter((e) => 
          e.detectionType === "anomaly" || 
          e.detectionType === "person" || 
          e.detectionType === "manual_recording" || 
          e.detectionType === "manual_snapshot"
        )
        .map((e) => {
          const meta: any = e.metadata || {};
          if (e.detectionType === "anomaly") {
            return { id: e._id, title: "Anomaly detected", severity: "Critical" as const, timestamp: e.timestamp };
          }
          if (e.detectionType === "manual_recording") {
            return { id: e._id, title: "Manual Recording", severity: "Medium" as const, timestamp: e.timestamp };
          }
          if (e.detectionType === "manual_snapshot") {
            return { id: e._id, title: "Manual Snapshot", severity: "Medium" as const, timestamp: e.timestamp };
          }
          const eventType = meta.eventType as string | undefined;
          const tid = typeof meta.trackId === "number" ? meta.trackId : undefined;
          const idPart = tid !== undefined ? ` #${tid}` : "";
          if (eventType === "loitering") {
            return { id: e._id, title: `Person${idPart} loitering`, severity: "High" as const, timestamp: e.timestamp };
          }
          if (eventType === "left") {
            return { id: e._id, title: `Person${idPart} left`, severity: "Medium" as const, timestamp: e.timestamp };
          }
          return null;
        })
        .filter(Boolean) as { id: string; title: string; severity: "Critical" | "High" | "Medium"; timestamp: string }[];

      alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentAlerts(alerts.slice(0, 5));
    } catch {
      // non-blocking
    }
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Cameras
            </CardTitle>
            <CameraIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {onlineCameras}/{cameras.length}
            </div>
            <p className="text-xs text-muted-foreground">
              cameras are online
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Anomalies Detected
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <div className="scale-75 -ml-1">
                  <MessageLoading />
                </div>
              ) : anomalyCount}
            </div>
            <p className="text-xs text-muted-foreground">
              in the last 24 hours
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <div className="scale-75 -ml-1">
                  <MessageLoading />
                </div>
              ) : totalEventsToday}
            </div>
            <p className="text-xs text-muted-foreground">
              recorded today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              <span className="mr-2 h-3 w-3 bg-green-500 rounded-full animate-pulse"></span>
              Operational
            </div>
            <p className="text-xs text-muted-foreground">
              All systems are running normally
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0">
            <div className="grid gap-2 flex-1">
              <CardTitle className="text-lg sm:text-xl">Live Feeds</CardTitle>
              <CardDescription className="text-sm">
                Real-time streams from active cameras.
              </CardDescription>
            </div>
            <Button asChild size="sm" className="self-start sm:ml-auto sm:self-auto gap-1">
              <Link href="/dashboard/cameras">
                View All
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            {cameras.length === 0 ? (
              <div className="col-span-2 py-8 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
                No cameras configured yet.
              </div>
            ) : cameras.slice(0, 4).map((camera) => {
              const image = PlaceHolderImages.find(p => p.id === camera.thumbnailUrlId);
              return (
                <div
                  key={camera._id}
                  className="rounded-lg border overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => window.location.href = `/dashboard/monitoring?camera=${camera._id}`}
                >
                  <div className="aspect-video relative bg-black">
                    <CameraFeed camera={camera} fallbackImage={image} />
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold truncate" title={camera.name}>{camera.name}</h3>
                    <p className="text-sm text-muted-foreground truncate" title={camera.location}>{camera.location}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`h-2 w-2 rounded-full ${camera.status === 'Online' ? 'bg-green-500 animate-pulse' : 'bg-destructive'}`} />
                      <span className="text-xs text-muted-foreground">{camera.status}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
            <CardDescription>
              Critical and high-priority alerts from the last 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alert</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAlerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-sm text-muted-foreground">
                      No alerts yet. Start monitoring to generate alerts.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentAlerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell>
                        <div className="font-medium">{alert.title}</div>
                        <Badge
                          variant={alert.severity === "Critical" ? "destructive" : "secondary"}
                          className="mt-1"
                        >
                          {alert.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">
                        {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
