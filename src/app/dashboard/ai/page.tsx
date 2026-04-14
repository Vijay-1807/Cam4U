'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Terminal, Cpu, Network, Server, ArrowRight, Activity, Zap } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

export default function AIPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [confidence, setConfidence] = useState({ person: 88, car: 95, anomaly: 12 });
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulate terminal logs
    const possibleLogs = [
      "[INFO] Loading YOLOv8 weights from cache...",
      "[INFO] CoreML delegate enabled.",
      "[WARN] Frame drop detected (drop_rate=0.02).",
      "[INFO] Inference time: 23ms",
      "[INFO] Model 'YOLO26M_L4_768_weights_best.pt' initialized successfully.",
      "[DEBUG] Detected object id=9x0a class=person conf=0.89",
      "[DEBUG] Running MIL aggregation for anomaly detection...",
      "[INFO] Status ok."
    ];
    let count = 0;
    const interval = setInterval(() => {
      setLogs(prev => {
        const newLogs = [...prev, `[${new Date().toISOString()}] ${possibleLogs[Math.floor(Math.random() * possibleLogs.length)]}`];
        return newLogs.slice(-20); // Keep last 20
      });

      // Jiggle confidence
      setConfidence(prev => ({
        person: Math.min(100, Math.max(0, prev.person + (Math.random() * 4 - 2))),
        car: Math.min(100, Math.max(0, prev.car + (Math.random() * 4 - 2))),
        anomaly: Math.min(100, Math.max(0, prev.anomaly + (Math.random() * 8 - 4))),
      }));
    }, 2000);

    // Initial logs
    setLogs([
      `[${new Date().toISOString()}] [INFO] Starting AI Engine...`,
      `[${new Date().toISOString()}] [INFO] CUDA not found, falling back to CPU/MPS.`,
    ]);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">AI Engine</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Monitor model performance, inference topologies, and live diagnostic logs.
        </p>
      </div>

      <Tabs defaultValue="status" className="space-y-6">
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="status">System Status</TabsTrigger>
          <TabsTrigger value="assistant">AI Assistant</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Topologies - 2 Col */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Network className="h-5 w-5 text-muted-foreground" />
                    Model Topology
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-8 px-4 bg-muted/10 rounded-2xl border border-border/50 overflow-x-auto shadow-[inset_0_0_20px_rgba(0,0,0,0.02)]">

                    {/* Input Node */}
                    <div className="flex flex-col items-center gap-3 min-w-[100px]">
                      <div className="h-16 w-16 bg-background border border-border flex items-center justify-center rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <Server className="h-6 w-6 text-foreground" />
                      </div>
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">WebRTC</span>
                    </div>

                    <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block opacity-40 animate-pulse" />

                    {/* GPU/Model Node */}
                    <div className="flex flex-col items-center gap-3 min-w-[120px]">
                      <div className="h-20 w-20 bg-primary border bg-[linear-gradient(45deg,hsl(var(--primary))_0%,hsl(var(--primary)/.8)_100%)] flex items-center justify-center rounded-2xl shadow-xl hover:scale-105 transition-transform relative">
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-primary"></span>
                        </span>
                        <Cpu className="h-8 w-8 text-primary-foreground" />
                      </div>
                      <span className="text-xs font-black text-foreground tracking-widest uppercase">YOLOv8 Engine</span>
                    </div>

                    <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block opacity-40 animate-pulse" />

                    {/* Output Node */}
                    <div className="flex flex-col items-center gap-3 min-w-[100px]">
                      <div className="h-16 w-16 bg-background border border-border flex items-center justify-center rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <Activity className="h-6 w-6 text-foreground" />
                      </div>
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Inference</span>
                    </div>

                  </div>
                </CardContent>
              </Card>

              {/* Terminal */}
              <Card className="border-border overflow-hidden bg-[#0A0A0A] shadow-lg">
                <CardHeader className="bg-white/5 border-b border-white/5 py-3 flex flex-row items-center gap-2 space-y-0">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/80"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500/80"></div>
                  </div>
                  <CardTitle className="text-xs font-mono text-neutral-400 ml-2">
                    system_logs@ai-engine ~
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 overflow-auto max-h-[300px] font-mono text-xs sm:text-sm">
                  {logs.map((log, i) => (
                    <div key={i} className={`mb-1.5 leading-relaxed tracking-tight ${log.includes('[ERROR]') ? 'text-red-400' : log.includes('[WARN]') ? 'text-yellow-400' : 'text-neutral-400'}`}>
                      {log}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </CardContent>
              </Card>

            </div>

            {/* Confidence Meters - 1 Col */}
            <div className="space-y-6">
              <Card className="h-full border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-muted-foreground" />
                    Class Confidence
                  </CardTitle>
                  <CardDescription>Real-time average confidence metrics across active zones.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">

                  {/* Person */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-black tracking-widest uppercase">Person</span>
                      <span className="text-xs font-mono font-medium text-muted-foreground">{confidence.person.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-700 ease-out" style={{ width: `${confidence.person}%` }}></div>
                    </div>
                  </div>

                  {/* Car */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-black tracking-widest uppercase">Vehicle</span>
                      <span className="text-xs font-mono font-medium text-muted-foreground">{confidence.car.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-700 ease-out" style={{ width: `${confidence.car}%` }}></div>
                    </div>
                  </div>

                  {/* Anomaly */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-black tracking-widest uppercase text-destructive">Anomaly</span>
                      <span className="text-xs font-mono font-bold text-destructive">{confidence.anomaly.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all duration-700 ease-out relative", confidence.anomaly > 50 ? "bg-destructive shadow-[0_0_15px_rgba(239,68,68,0.8)]" : "bg-primary")}
                        style={{ width: `${confidence.anomaly}%` }}
                      >
                        {confidence.anomaly > 50 && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                      </div>
                    </div>
                  </div>

                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="assistant" className="space-y-4">
          <div className="h-[400px] sm:h-[500px] lg:h-[600px] flex flex-col items-center justify-center border border-dashed rounded-2xl bg-muted/5 gap-4">
            <Badge variant="outline" className="px-4 py-1 text-sm bg-primary/5">Active</Badge>
            <p className="text-muted-foreground max-w-sm text-center">The AI Assistant is currently running natively as a floating widget. You can chat with it from anywhere in the application.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
