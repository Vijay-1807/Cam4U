'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { MessageSquare, Sparkles } from 'lucide-react';
import { MessageLoading } from '@/components/ui/message-loading';
import { useToast } from '@/hooks/use-toast';

interface NaturalLanguageQueryProps {
  onQueryResult?: (query: any) => void;
}

export function NaturalLanguageQuery({ onQueryResult }: NaturalLanguageQueryProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const exampleQueries = [
    "Show me all anomalies yesterday",
    "What happened at Camera 0 last week?",
    "Find all hammer and knife detections",
    "Show anomalies detected in the last 24 hours",
  ];

  const handleQuery = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);
    try {
      // Parse natural language query into search filters
      const filters: any = {};
      const lowerQuery = query.toLowerCase();
      
      // Parse date references
      if (lowerQuery.includes('yesterday')) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        filters.startDate = yesterday.toISOString().split('T')[0];
        filters.endDate = new Date().toISOString().split('T')[0];
      } else if (lowerQuery.includes('last week')) {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        filters.startDate = lastWeek.toISOString().split('T')[0];
      } else if (lowerQuery.includes('last 24 hours')) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        filters.startDate = yesterday.toISOString();
      }
      
      // Parse object types
      if (lowerQuery.includes('people') || lowerQuery.includes('person')) {
        filters.objects = ['person'];
      }
      if (lowerQuery.includes('hammer')) {
        filters.objects = [...(filters.objects || []), 'Hammer'];
      }
      if (lowerQuery.includes('knife') || lowerQuery.includes('knives')) {
        filters.objects = [...(filters.objects || []), 'knife'];
      }
      if (lowerQuery.includes('gun') || lowerQuery.includes('handgun') || lowerQuery.includes('weapon')) {
        filters.objects = [...(filters.objects || []), 'handgun'];
      }
      if (lowerQuery.includes('bat') || lowerQuery.includes('cricket bat')) {
        filters.objects = [...(filters.objects || []), 'cricket bat'];
      }
      if (lowerQuery.includes('axe') || lowerQuery.includes('sickle')) {
        filters.objects = [...(filters.objects || []), 'axe', 'sickle'];
      }
      
      // Parse detection type
      if (lowerQuery.includes('anomal')) {
        filters.detectionType = 'anomaly';
      }
      
      // Parse confidence
      if (lowerQuery.includes('high confidence')) {
        filters.minConfidence = 0.7;
      }
      
      // Use advanced search API
      const response = await apiClient.searchEvents(filters);
      setResult({ query: filters, events: response.events });
      if (onQueryResult) {
        onQueryResult({ query: filters, events: response.events });
      }
      toast({
        title: 'Query Processed',
        description: `Found ${response.events.length} events`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process query',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const useExample = (example: string) => {
    setQuery(example);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Natural Language Query
        </CardTitle>
        <CardDescription>
          Ask questions about your events in natural language
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
            placeholder="e.g., Show me all anomalies yesterday"
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={handleQuery} disabled={loading || !query.trim()}>
            {loading ? (
              <div className="scale-75 brightness-0 invert">
                <MessageLoading />
              </div>
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-2">Example queries:</p>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((example, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => useExample(example)}
                className="text-xs"
              >
                {example}
              </Button>
            ))}
          </div>
        </div>
        {result && (
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm font-medium">
              Found {result.events?.length || 0} events
            </p>
            {result.query && (
              <pre className="text-xs overflow-auto bg-background p-2 rounded">
                {JSON.stringify(result.query, null, 2)}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

