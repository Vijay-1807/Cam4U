"use client";

import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { apiClient, Camera } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import Image from "next/image";
import { AddCameraDialog } from "./_components/add-camera-dialog";
import { EditCameraDialog } from "./_components/edit-camera-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Camera as CameraIcon, RefreshCw, Maximize2, Video, Camera as CameraAction, AlertCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MessageLoading } from "@/components/ui/message-loading";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface CameraFeedRef {
  type: 'usb' | 'ip' | 'none';
  element: HTMLVideoElement | HTMLImageElement | null;
}

const CameraFeed = forwardRef<CameraFeedRef, { camera: Camera, fallbackImage?: any, onOffline?: () => void }>(({ camera, fallbackImage, onOffline }, ref) => {
  const [error, setError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useImperativeHandle(ref, () => {
    if (camera.status === 'Offline' || error) {
       return { type: 'none' as const, element: null };
    }
    if (camera.type === 'usb') {
       return { type: 'usb' as const, element: videoRef.current };
    }
    if (camera.type === 'ip') {
       return { type: 'ip' as const, element: imgRef.current };
    }
    return { type: 'none' as const, element: null };
  });

  useEffect(() => {
    if (camera.type === 'usb' && camera.status === 'Online' && !error) {
      const initCamera = async () => {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(d => d.kind === 'videoinput');
          const targetDevice = videoDevices[camera.index] || videoDevices[0];
          
          if (targetDevice) {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: targetDevice.deviceId } }
            });
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
            }
          } else {
            setError(true);
            if (onOffline) onOffline();
          }
        } catch (err) {
          console.error("Camera access error:", err);
          setError(true);
          if (onOffline) onOffline();
        }
      };
      
      initCamera();
      
      return () => {
         if (videoRef.current?.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(t => t.stop());
         }
      };
    }
  }, [camera, error, onOffline]);

  if (camera.status === 'Offline') {
    return fallbackImage ? (
      <Image
        src={fallbackImage.imageUrl}
        alt={`Feed from ${camera.name}`}
        width={600}
        height={400}
        priority={true}
        className={`w-full h-full object-cover opacity-80 transition-opacity duration-500 grayscale`}
      />
    ) : (
      <CameraIcon className="h-12 w-12 text-muted-foreground opacity-50 grayscale" />
    );
  }

  if (camera.type === 'ip' && !error) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={imgRef}
        src={camera.url}
        alt={`Live feed from ${camera.name}`}
        crossOrigin="anonymous"
        onError={() => {
          setError(true);
          if (onOffline) onOffline();
        }}
        className={`w-full h-full object-cover transition-opacity duration-500 group-hover:opacity-100`}
      />
    );
  }

  if (camera.type === 'usb' && !error) {
    return (
      <video 
        ref={videoRef}
        autoPlay 
        playsInline
        muted
        className={`w-full h-full object-cover transition-opacity duration-500 group-hover:opacity-100`}
      />
    );
  }

  return fallbackImage ? (
    <Image
      src={fallbackImage.imageUrl}
      alt={`Feed from ${camera.name}`}
      width={600}
      height={400}
      priority={true}
      className={`w-full h-full object-cover opacity-80 transition-opacity duration-500 group-hover:opacity-100 ${camera.status === 'Offline' ? 'grayscale' : ''}`}
    />
  ) : (
    <CameraIcon className="h-12 w-12 text-muted-foreground" />
  );
});

CameraFeed.displayName = "CameraFeed";

const CameraCard = ({ camera, image, onDelete, loadCameras }: { camera: Camera, image: any, onDelete: (id: string) => void, loadCameras: () => void }) => {
  const [error, setError] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const { toast } = useToast();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  const feedRef = useRef<CameraFeedRef>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString() + " " + now.toLocaleDateString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCameraOffline = () => {
    // We can just set error state locally, or update the parent.
    // For now we just show gray offline state locally.
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      cardRef.current?.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.log(err));
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement && document.fullscreenElement === cardRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const takeSnapshot = () => {
    const feed = feedRef.current;
    if (!feed || !feed.element) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (feed.type === "usb" && feed.element instanceof HTMLVideoElement) {
      canvas.width = feed.element.videoWidth || 640;
      canvas.height = feed.element.videoHeight || 480;
      ctx.drawImage(feed.element, 0, 0, canvas.width, canvas.height);
    } else if (feed.type === "ip" && feed.element instanceof HTMLImageElement) {
      canvas.width = feed.element.naturalWidth || feed.element.width || 640;
      canvas.height = feed.element.naturalHeight || feed.element.height || 480;
      ctx.drawImage(feed.element, 0, 0, canvas.width, canvas.height);
    } else {
      return;
    }

    try {
      const dataUrl = canvas.toDataURL("image/jpeg");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `snapshot_${camera.name}_${new Date().getTime()}.jpg`;
      link.click();
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        toast({ title: "Saving...", description: "Uploading snapshot to cloud history..." });
        try {
          const uploadRes = await apiClient.uploadMedia(blob, 'image');
          await apiClient.createEvent({
            detectionType: 'manual_snapshot',
            objects: ['snapshot'],
            confidence: 1.0,
            location: `Camera ${camera.name}`,
            ...({ imageUrl: uploadRes.url } as any),
            metadata: {
              public_id: uploadRes.public_id,
              type: 'snapshot'
            }
          });
          toast({ title: "Saved", description: "Snapshot saved to history." });
        } catch (uploadErr) {
          console.error("Upload failed", uploadErr);
          toast({ title: "Warning", description: "Saved locally, but failed to sync to cloud.", variant: "destructive" });
        }
      }, "image/jpeg");

    } catch(e) {
      console.error("Failed to export snapshot (might be cross-origin blocked):", e);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      isRecordingRef.current = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    try {
      const feed = feedRef.current;
      if (!feed || !feed.element) return;
      
      let stream: MediaStream;
      isRecordingRef.current = true;
      
      if (feed.type === "usb" && feed.element instanceof HTMLVideoElement && feed.element.srcObject) {
        stream = feed.element.srcObject as MediaStream;
      } else if (feed.type === "ip" && feed.element instanceof HTMLImageElement && canvasRef.current) {
        const theImg = feed.element;
        const theCanvas = canvasRef.current;
        const drawFrame = () => {
          if (theImg && theCanvas) {
            const ctx = theCanvas.getContext('2d');
            if (ctx) {
              if (theCanvas.width !== (theImg.naturalWidth || 640)) theCanvas.width = (theImg.naturalWidth || 640);
              if (theCanvas.height !== (theImg.naturalHeight || 480)) theCanvas.height = (theImg.naturalHeight || 480);
              ctx.drawImage(theImg, 0, 0, theCanvas.width, theCanvas.height);
            }
          }
          if (isRecordingRef.current) {
            animationFrameRef.current = requestAnimationFrame(drawFrame);
          }
        };
        drawFrame();
        stream = theCanvas.captureStream(30);
      } else {
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      recordingChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(recordingChunksRef.current, { type: "video/webm" });
        recordingChunksRef.current = [];
        if (blob.size === 0) return;
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recording_${camera.name}_${new Date().getTime()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        
        toast({ title: "Syncing...", description: "Uploading video to history (this may take a moment)..." });
        try {
          const uploadRes = await apiClient.uploadMedia(blob, 'video');
          await apiClient.createEvent({
            detectionType: 'manual_recording',
            objects: ['recording'],
            confidence: 1.0,
            location: `Camera ${camera.name}`,
            ...({ videoUrl: uploadRes.url } as any),
            metadata: {
              duration_est: "manual",
              public_id: uploadRes.public_id
            }
          });
          toast({ title: "Synced", description: "Recording saved to history." });
        } catch (err: any) {
          console.error("Cloud sync failed", err);
          toast({ title: "Sync Failed", description: "Saved locally only. " + (err.message || ""), variant: "destructive" });
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) {
      console.error("Recording error", e);
    }
  };

  return (
    <Card 
      ref={cardRef} 
      className={`overflow-hidden group border-border/50 hover:border-primary/50 transition-colors ${isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-black flex flex-col' : 'relative'}`} 
    >
      <CardHeader className={`relative p-0 bg-black flex-col items-center justify-center ${isFullscreen ? 'flex-1' : 'aspect-video'}`}>
        <CameraFeed ref={feedRef} camera={camera} fallbackImage={image} onOffline={handleCameraOffline} />
        
        {/* Hidden Canvas for IP Recording */}
        {camera.type === 'ip' && <canvas ref={canvasRef} className="hidden" />}

        {/* CCTV Overlay Effects */}
        <div className="absolute inset-0 pointer-events-none border-[rgba(255,255,255,0.1)] border">
          {/* Crosshairs */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 opacity-40">
            <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white -translate-x-1/2"></div>
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-white -translate-y-1/2"></div>
          </div>
          {/* Four corners */}
          <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-white/50"></div>
          <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-white/50"></div>
          <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-white/50"></div>
          <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-white/50"></div>
          
          {/* Time & Camera Name Overlay */}
          <div className="absolute bottom-3 left-4 text-white/80 font-mono text-[10px] md:text-sm shadow-black drop-shadow-md">
            <div>CAM: {camera.name.toUpperCase()}</div>
            <div>{currentTime}</div>
          </div>
        </div>

        {/* Top Status Badges */}
        <div className="absolute top-3 left-4 flex flex-col gap-2">
          {camera.status === 'Online' && !error && (
            <div className="flex items-center gap-2 bg-background/40 backdrop-blur-md border border-border/40 px-2 py-1 rounded-md shadow-sm w-fit">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
              </span>
              <span className="text-[10px] font-bold tracking-widest text-foreground uppercase">Live</span>
            </div>
          )}
          {isRecording && (
            <div className="flex items-center gap-2 bg-destructive/80 backdrop-blur-md px-2 py-1 rounded-md shadow-sm w-fit animate-pulse">
              <span className="text-[10px] font-bold tracking-widest text-white uppercase">REC</span>
            </div>
          )}
        </div>

        {/* Top Right Controls Overlay */}
        <div className={`absolute top-3 right-4 flex items-center gap-2 transition-opacity ${isFullscreen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" onClick={takeSnapshot} className="h-8 w-8 rounded-full bg-background/40 hover:bg-background/80 backdrop-blur-md text-foreground shadow-sm">
                  <CameraAction className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Take Snapshot</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={isRecording ? "destructive" : "secondary"} size="icon" onClick={toggleRecording} className={`h-8 w-8 rounded-full ${!isRecording && 'bg-background/40 hover:bg-background/80'} backdrop-blur-md text-foreground shadow-sm`}>
                  <Video className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isRecording ? 'Stop Recording' : 'Start Recording'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" onClick={toggleFullscreen} className="h-8 w-8 rounded-full bg-background/40 hover:bg-background/80 backdrop-blur-md text-foreground shadow-sm">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fullscreen</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      
      {!isFullscreen && (
        <CardContent className="p-4 bg-card">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg truncate max-w-[140px]" title={camera.name}>
                {camera.name}
              </CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1 truncate max-w-[140px]" title={camera.location}>
                {camera.location}
              </CardDescription>
              <div className="text-xs text-muted-foreground mt-2 truncate max-w-[180px]" title={camera.url}>
                {camera.type.toUpperCase()}: {camera.url}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={camera.status === 'Online' ? 'secondary' : 'outline'} className="whitespace-nowrap rounded-sm font-medium">
                {camera.status}
              </Badge>
              <div className="flex items-center gap-1">
                <EditCameraDialog camera={camera} onCameraUpdated={loadCameras} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(camera._id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const handleCameraOffline = (id: string) => {
    setCameras(prev => prev.map(c => c._id === id ? { ...c, status: 'Offline' } : c));
  };

  const loadCameras = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getCameras();
      setCameras(data);
    } catch (error) {
      toast({
        title: "Error fetching cameras",
        description: "Could not load the camera list.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this camera?")) return;
    try {
      await apiClient.deleteCamera(id);
      toast({ title: "Camera Deleted" });
      loadCameras();
    } catch (err) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Camera Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">View, add, and manage your security cameras.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadCameras} disabled={loading} className="relative">
            {loading ? (
              <div className="scale-75">
                <MessageLoading />
              </div>
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <AddCameraDialog onCameraAdded={loadCameras} />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 gap-4">
          <MessageLoading />
          <p className="text-sm text-muted-foreground animate-pulse">Syncing cameras...</p>
        </div>
      ) : cameras.length === 0 ? (
        <Card className="text-center p-12 border-dashed">
          <div className="flex justify-center mb-4">
            <CameraIcon className="h-12 w-12 text-muted-foreground opacity-50" />
          </div>
          <CardTitle className="mb-2">No cameras configured</CardTitle>
          <CardDescription className="mb-6">
            Add your first camera to start monitoring the premises.
          </CardDescription>
          <AddCameraDialog onCameraAdded={loadCameras} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cameras.map((camera) => {
            // Pick a consistent random placeholder based on the name for visual flair
            const charCode = camera.name.charCodeAt(0) || 0;
            const pId = (charCode % 5) + 1; // feed-1 to feed-5
            const image = PlaceHolderImages.find((p) => p.id === `feed-${pId}`);

            return (
              <CameraCard 
                key={camera._id} 
                camera={camera} 
                image={image} 
                onDelete={handleDelete} 
                loadCameras={loadCameras} 
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
