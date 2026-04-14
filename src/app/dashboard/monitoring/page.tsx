'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Play, Square, Camera, Zap, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { detectionClient, DetectionStatus } from '@/lib/detection';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Camera as CameraType } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function MonitoringPageContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDetecting, setIsDetecting] = useState(false);
  const isDetectingRef = useRef(false);
  const [status, setStatus] = useState<DetectionStatus>({ active: false });
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [enableAnomaly, setEnableAnomaly] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const framePollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const suppressFallbackRef = useRef(false);

  const searchParams = useSearchParams();
  const initCameraParam = searchParams.get('camera');

  // Camera Selection State
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>(initCameraParam || '0'); // Default to param or '0' for legacy
  const [selectedCameraName, setSelectedCameraName] = useState<string>('Default Webcam');

  // Recording & Snapshot Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingChunksRef = useRef<Blob[]>([]);

  // Live Anomaly Graph & Notification Refs
  const [anomalyHistory, setAnomalyHistory] = useState<{ time: string, score: number }[]>([]);
  const lastAnomalyToastRef = useRef<number>(0);

  // Check status on mount
  useEffect(() => {
    checkStatus();
    return () => {
      suppressFallbackRef.current = true;
      detectionClient.disconnectWebSocket();
      suppressFallbackRef.current = false;
      if (framePollTimeoutRef.current) clearTimeout(framePollTimeoutRef.current);
      framePollTimeoutRef.current = null;
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  useEffect(() => {
    // Load cameras on mount
    const loadCameras = async () => {
      try {
        const data = await apiClient.getCameras();
        setCameras(data);
      } catch (err) {
        console.error("Failed to load cameras", err);
      }
    };
    loadCameras();
  }, []);

  useEffect(() => {
    isDetectingRef.current = isDetecting;
  }, [isDetecting]);

  useEffect(() => {
    if (isDetecting && !wsConnected) {
      connectWebSocket();
    } else if (!isDetecting && wsConnected) {
      suppressFallbackRef.current = true;
      detectionClient.disconnectWebSocket();
      setWsConnected(false);
      suppressFallbackRef.current = false;
    }
  }, [isDetecting]);

  // Update canvas for recording whenever frame updates
  useEffect(() => {
    if (currentFrame && canvasRef.current && isRecording) {
      const image = new Image();
      image.onload = () => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          // Ensure canvas dimensions match image to avoid stretching in recording
          if (canvasRef.current.width !== image.width || canvasRef.current.height !== image.height) {
            canvasRef.current.width = image.width;
            canvasRef.current.height = image.height;
          }
          ctx.drawImage(image, 0, 0);
        }
      };
      image.src = currentFrame;
    }
  }, [currentFrame, isRecording]);

  const checkStatus = async () => {
    try {
      const currentStatus = await detectionClient.getStatus();
      setStatus(currentStatus);
      setIsDetecting(currentStatus.active || false);

      if (currentStatus.active) {
        connectWebSocket();
        startStatusUpdates();
      }
    } catch (error: any) {
      console.error('Status check error:', error);
    }
  };

  const handleIncomingStatus = (incomingStatus: any) => {
    setStatus(incomingStatus);

    // Process Anomaly Data for Graph
    if (incomingStatus.anomaly_score !== undefined) {
      setAnomalyHistory(prev => {
        const newHist = [...prev, { time: new Date().toLocaleTimeString(), score: incomingStatus.anomaly_score }];
        return newHist.slice(-100); // keep last 100 frames
      });
    }

    // Process Pop Notification
    if (incomingStatus.is_anomaly) {
      const now = Date.now();
      if (now - lastAnomalyToastRef.current > 5000) { // Limit to once every 5 seconds
        toast({
          title: '🚨 Anomaly Detected!',
          description: `Suspicious activity detected! Score: ${(incomingStatus.anomaly_score || 0).toFixed(2)}`,
          variant: 'destructive',
          duration: 4000
        });
        lastAnomalyToastRef.current = now;
      }
    }
  };

  const connectWebSocket = () => {
    suppressFallbackRef.current = true;
    detectionClient.disconnectWebSocket();
    suppressFallbackRef.current = false;

    detectionClient.connectWebSocket({
      onConnected: () => {
        console.log('✅ WebSocket connected - real-time streaming active');
        setWsConnected(true);
      },
      onFrame: (data) => {
        if (data.frame && data.ready) {
          setCurrentFrame(data.frame);
          handleIncomingStatus(data.status);
        } else if (data.status) {
          handleIncomingStatus(data.status);
        }
      },
      onStatus: (status) => {
        handleIncomingStatus(status);
        if (!status.active) {
          setIsDetecting(false);
          stopUpdates();
        }
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
        if (isDetecting) {
          console.log('Falling back to HTTP polling...');
          startFrameUpdatesPolling();
        }
      },
      onDisconnected: () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
        if (!suppressFallbackRef.current && isDetectingRef.current) {
          startFrameUpdatesPolling();
        }
      }
    });
  };

  const startFrameUpdatesPolling = () => {
    if (framePollTimeoutRef.current) clearTimeout(framePollTimeoutRef.current);
    framePollTimeoutRef.current = null;

    let consecutiveErrors = 0;
    let currentDelay = 100;
    let cancelled = false;

    const loop = async () => {
      if (cancelled || !isDetecting) return;

      try {
        const frameData = await detectionClient.getFrame();
        if (frameData.ready && frameData.frame) {
          setCurrentFrame(frameData.frame);
          handleIncomingStatus(frameData.status);
          consecutiveErrors = 0;
          currentDelay = 33;
        } else {
          handleIncomingStatus(frameData.status);
          consecutiveErrors++;
          currentDelay = Math.min(100 * Math.pow(2, Math.min(consecutiveErrors, 3)), 1000);
        }
      } catch (error: any) {
        consecutiveErrors++;
        if (error.message && (error.message.includes('404') || error.message.includes('No active'))) {
          if (consecutiveErrors === 1) {
            console.log("Session ended, stopping polling.");
          }
          stopUpdates();
          setIsDetecting(false);
          setCurrentFrame(null);
          return;
        }
        currentDelay = Math.min(100 * Math.pow(2, Math.min(consecutiveErrors, 4)), 2000);
      } finally {
        if (!cancelled && isDetecting) {
          framePollTimeoutRef.current = setTimeout(loop, currentDelay);
        }
      }
    };

    loop();
  };

  const startStatusUpdates = () => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
    }
    statusIntervalRef.current = setInterval(async () => {
      try {
        const currentStatus = await detectionClient.getStatus();
        handleIncomingStatus(currentStatus);
        if (!currentStatus.active) {
          setIsDetecting(false);
          stopUpdates();
        }
      } catch (error: any) {
        // Silently fail on status check if backend down
      }
    }, 1000);
  };

  const stopUpdates = () => {
    suppressFallbackRef.current = true;
    detectionClient.disconnectWebSocket();
    setWsConnected(false);
    suppressFallbackRef.current = false;

    if (framePollTimeoutRef.current) clearTimeout(framePollTimeoutRef.current);
    framePollTimeoutRef.current = null;
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
  };

  const handleStart = async (overrideAnomaly?: boolean) => {
    try {
      const anomalyState = overrideAnomaly !== undefined ? overrideAnomaly : enableAnomaly;

      // Resolve the selected camera string to either an integer (USB) or URL (IP)
      let resolvedCameraId: string | number = 0;

      if (selectedCameraId !== '0') {
        const cam = cameras.find(c => c._id === selectedCameraId);
        if (cam) {
          resolvedCameraId = cam.type === 'usb' ? cam.index : cam.url;
          setSelectedCameraName(cam.name);
        }
      } else {
        setSelectedCameraName('Default Webcam');
      }

      await detectionClient.startDetection({
        camera_id: resolvedCameraId as any,
        enable_anomaly: anomalyState,
      });

      setIsDetecting(true);
      toast({
        title: 'Success',
        description: 'Detection started successfully',
      });

      setTimeout(() => {
        if (isDetecting) {
          connectWebSocket();
          startStatusUpdates();
        }
      }, 300);
    } catch (error: any) {
      if (error.message && error.message.includes('already running')) {
        connectWebSocket();
        startStatusUpdates();
        return;
      }
      toast({
        title: 'Error',
        description: error.message || 'Failed to start detection',
        variant: 'destructive',
      });
    }
  };

  const handleStop = async () => {
    try {
      if (isRecording) {
        stopRecording();
      }
      await detectionClient.stopDetection();
      setIsDetecting(false);
      setCurrentFrame(null);
      setAnomalyHistory([]); // Clear graph history on stop
      stopUpdates();

      toast({
        title: 'Success',
        description: 'Detection stopped',
      });

      setStatus({ active: false });
    } catch (error: any) {
      setIsDetecting(false);
      stopUpdates();
    }
  };

  const handleAnomalyToggle = async () => {
    const newState = !enableAnomaly;
    setEnableAnomaly(newState);
    if (isDetecting) {
      toast({ title: 'Updating...', description: 'Restarting detection with new settings.' });
      await detectionClient.stopDetection();
      stopUpdates();
      setTimeout(() => handleStart(newState), 500);
    }
  };

  // --- Snapshot & Recording Logic ---

  const takeSnapshot = async () => {
    if (!currentFrame) return;
    try {
      // 1. Create a blob from the base64 string
      const response = await fetch(currentFrame);
      const blob = await response.blob();

      // 2. Download locally (immediate feedback)
      const link = document.createElement('a');
      link.href = currentFrame;
      link.download = `snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 3. Upload to cloud (background)
      toast({ title: "Saving...", description: "Uploading snapshot to cloud history..." });

      try {
        // Use apiClient to upload
        const uploadRes = await apiClient.uploadMedia(blob, 'image');

        await apiClient.createEvent({
          detectionType: 'manual_snapshot',
          objects: ['snapshot'],
          confidence: 1.0,
          location: selectedCameraName,
          // Pass the CLOUDINARY URL directly
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

    } catch (e) {
      console.error("Snapshot error", e);
      toast({ title: "Error", description: "Failed to save snapshot", variant: "destructive" });
    }
  };

  const startRecording = () => {
    if (!isDetecting) {
      toast({ title: "Error", description: "Detection must be active to record.", variant: "destructive" });
      return;
    }

    // We need at least one frame to init the canvas size
    if (!currentFrame) {
      toast({ title: "Wait", description: "Waiting for video feed..." });
      return;
    }

    // Force an initial draw to set canvas dimensions before stream capture
    if (canvasRef.current) {
      const image = new Image();
      image.onload = () => {
        if (canvasRef.current) {
          canvasRef.current.width = image.width;
          canvasRef.current.height = image.height;
          canvasRef.current.getContext('2d')?.drawImage(image, 0, 0);

          // Now start recording
          try {
            const stream = canvasRef.current.captureStream(30); // 30 FPS target
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

            recordingChunksRef.current = [];
            recorder.ondataavailable = (e) => {
              if (e.data.size > 0) {
                recordingChunksRef.current.push(e.data);
              }
            };

            recorder.onstop = async () => {
              const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
              recordingChunksRef.current = [];
              if (blob.size === 0) return;

              // 1. Download locally
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);

              // 2. Upload to Cloud
              toast({ title: "Syncing...", description: "Uploading video to history (this may take a moment)..." });

              try {
                const uploadRes = await apiClient.uploadMedia(blob, 'video');

                await apiClient.createEvent({
                  detectionType: 'manual_recording',
                  objects: ['recording'],
                  confidence: 1.0,
                  location: selectedCameraName,
                  // Pass the CLOUDINARY URL directly
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
            toast({ title: "Recording Started", description: "Recording video feed..." });
          } catch (e) {
            console.error("MediaRecorder error:", e);
            toast({ title: "Error", description: "Failed to start recording. Browser may not support it.", variant: "destructive" });
          }
        }
      };
      image.src = currentFrame;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Live Monitoring</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Real-time object detection and anomaly detection
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">

          <Select
            value={selectedCameraId}
            onValueChange={setSelectedCameraId}
            disabled={isDetecting}
          >
            <SelectTrigger className="w-[200px] h-10 border-border/50 bg-background/50 backdrop-blur-sm">
              <Camera className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Select Camera" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Default Laptop Webcam</SelectItem>
              {cameras.map(cam => (
                <SelectItem key={cam._id} value={cam._id}>
                  {cam.name} ({cam.type.toUpperCase()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={handleAnomalyToggle}
            className={cn(enableAnomaly && 'bg-primary text-primary-foreground', 'w-full sm:w-auto h-10')}
          >
            <Zap className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Anomaly Detection</span>
            <span className="sm:hidden">Anomaly</span>
          </Button>
          {isDetecting ? (
            <Button onClick={handleStop} variant="destructive" className="w-full sm:w-auto h-10">
              <Square className="mr-2 h-4 w-4" />
              Stop Detection
            </Button>
          ) : (
            <Button onClick={() => handleStart()} className="w-full sm:w-auto h-10">
              <Play className="mr-2 h-4 w-4" />
              Start Detection
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3 flex-1">
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 sm:pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-lg sm:text-xl">Live Detection Feed</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {isDetecting ? 'Detection active' : 'Click Start to begin detection'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {wsConnected && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500">
                      WebSocket
                    </Badge>
                  )}
                  {isRecording && (
                    <Badge variant="outline" className="border-destructive text-destructive flex items-center gap-2 bg-destructive/10 px-2 py-0.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-destructive"></span>
                      </span>
                      REC
                    </Badge>
                  )}
                  {isDetecting && status.fps && (
                    <Badge variant="outline" className="self-start sm:self-auto">
                      {status.fps.toFixed(1)} FPS
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 relative p-0 bg-black rounded-b-lg min-h-[300px] sm:min-h-[400px] flex flex-col group overflow-hidden">
              {/* Main Video Area */}
              <div className="relative flex-grow flex items-center justify-center p-0">
                {currentFrame ? (
                  <img
                    src={currentFrame}
                    alt="Detection feed"
                    className="w-full h-full object-cover"
                    style={{ imageRendering: 'auto' }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground p-4">
                    {isDetecting ? (
                      <div className="text-center">
                        <Camera className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 animate-pulse" />
                        <p className="text-sm sm:text-base">Initializing camera...</p>
                        <p className="text-xs text-muted-foreground mt-2">Waiting for video feed...</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Camera className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4" />
                        <p className="text-sm sm:text-base">No active detection</p>
                        <p className="text-xs sm:text-sm mt-2">Click Start Detection to begin</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Hidden canvas for recording */}
                <canvas ref={canvasRef} className="hidden" />

                {status.is_anomaly && (
                  <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 z-10">
                    <div className="bg-destructive/95 backdrop-blur-md border border-destructive/50 text-destructive-foreground p-3 sm:p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 shadow-2xl">
                      <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 animate-pulse" />
                      <div className="min-w-0">
                        <p className="font-bold text-sm sm:text-base tracking-wide">CRITICAL ANOMALY DETECTED</p>
                        <p className="text-xs sm:text-sm font-medium opacity-90">Confidence: {((status.anomaly_score || 0) * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Controls Toolbar - Glassmorphic Overlay */}
                <div className={cn("absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/40 backdrop-blur-md border border-border/50 p-1.5 rounded-2xl shadow-xl transition-all duration-300 z-10", currentFrame ? "opacity-0 group-hover:opacity-100 hover:opacity-100 translate-y-2 group-hover:translate-y-0" : "opacity-100")}>
                  <TooltipProvider>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" size="icon" onClick={takeSnapshot} disabled={!currentFrame} className="rounded-xl h-10 w-10 bg-background/60 hover:bg-background/90 border-0 shadow-none text-foreground">
                          <Camera className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs border-border/50 backdrop-blur-sm">Take Snapshot</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isRecording ? "destructive" : "secondary"}
                          size="icon"
                          onClick={toggleRecording}
                          disabled={!currentFrame}
                          className={cn("rounded-xl h-10 w-10 transition-all border-0 shadow-none text-foreground", !isRecording && "bg-background/60 hover:bg-background/90", isRecording && "bg-destructive text-destructive-foreground animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]")}
                        >
                          {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Video className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs border-border/50 backdrop-blur-sm">{isRecording ? "Stop Recording" : "Start Recording"}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Detection Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={isDetecting ? 'default' : 'secondary'}>
                    {isDetecting ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              {isDetecting && status.fps && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">FPS</span>
                    <span className="font-medium">{status.fps.toFixed(1)}</span>
                  </div>
                </div>
              )}

              {enableAnomaly && anomalyHistory.length > 0 && (
                <div className="pt-2 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Live Anomaly Graph</span>
                  </div>
                  <div className="h-[120px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={anomalyHistory}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 1]} hide />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '4px', fontSize: '12px' }} />
                        <Area type="monotone" dataKey="score" stroke="#ef4444" fillOpacity={1} fill="url(#colorScore)" isAnimationActive={false} />
                        <ReferenceLine y={0.5} stroke="gray" strokeDasharray="3 3" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {isDetecting && status.detections !== undefined && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Objects Detected</span>
                    <span className="font-medium">{status.detections}</span>
                  </div>
                </div>
              )}

              {enableAnomaly && status.anomaly_score !== undefined && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Anomaly Score</span>
                    <span className={cn(
                      'font-medium',
                      status.is_anomaly ? 'text-red-600' : 'text-green-600'
                    )}>
                      {status.anomaly_score.toFixed(3)}
                    </span>
                  </div>
                  {status.is_anomaly && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-sm text-red-600 dark:text-red-400">
                      Anomaly detected!
                    </div>
                  )}
                </div>
              )}

              {isDetecting && selectedCameraName && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Camera</span>
                    <span className="font-medium">{selectedCameraName}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function MonitoringPage() {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center">Loading Monitoring...</div>}>
      <MonitoringPageContent />
    </Suspense>
  );
}
