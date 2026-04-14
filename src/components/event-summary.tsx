'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Event } from '@/lib/api';
import { Calendar, MapPin, Activity } from 'lucide-react';
import Image from 'next/image';

interface EventSummaryProps {
  event: Event;
}

export function EventSummary({ event }: EventSummaryProps) {
  const anomalyScore = event.metadata?.anomalyScore
    ? Math.round(event.metadata.anomalyScore * 100)
    : 0;

  return (
    <div className="space-y-4">
      {event.videoUrl ? (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-black flex items-center justify-center">
          <video 
            src={event.videoUrl} 
            controls 
            className="w-full h-full"
          />
        </div>
      ) : (event.snapshotUrl || event.imageUrl) && (
        <div className="relative w-full h-64 rounded-lg overflow-hidden border bg-muted">
          <Image
            src={event.snapshotUrl || event.imageUrl || ''}
            alt="Event snapshot"
            fill
            className="object-contain"
          />
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>Complete information about this detection event</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{event.detectionType}</Badge>
            <Badge variant="secondary">{event.location}</Badge>
            {anomalyScore > 0 && (
              <Badge variant={anomalyScore > 80 ? "destructive" : "outline"}>
                Anomaly: {anomalyScore}%
              </Badge>
            )}
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Timestamp</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(event.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Location</p>
                <p className="text-sm text-muted-foreground">{event.location}</p>
              </div>
            </div>
            
            {event.fps && (
              <div className="flex items-start gap-3">
                <Activity className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">FPS</p>
                  <p className="text-sm text-muted-foreground">{event.fps}</p>
                </div>
              </div>
            )}
            
            {event.confidence && (
              <div className="flex items-start gap-3">
                <Activity className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Confidence</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(event.confidence * 100)}%
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {event.objects && event.objects.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Detected Objects:</p>
              <div className="flex gap-2 flex-wrap">
                {event.objects.map((obj, idx) => (
                  <Badge key={idx} variant="secondary">
                    {obj}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {event.videoUrl && (
            <div className="pt-2">
              <p className="text-sm font-medium mb-3">Cloud Backup Link:</p>
              <a
                href={event.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-primary/10 text-primary px-3 py-2 rounded-md hover:bg-primary/20 transition-colors inline-flex items-center gap-2"
              >
                <Activity className="h-3 w-3" />
                Raw Media URL
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

