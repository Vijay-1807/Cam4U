'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { Sparkles, Check } from 'lucide-react';
import { MessageLoading } from '@/components/ui/message-loading';
import { useToast } from '@/hooks/use-toast';

export function AlertRulesSuggestions() {
  const [location, setLocation] = useState('');
  const [rules, setRules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateRules = async () => {
    if (!location.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a camera location',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setRules([]);
    try {
      const response = await apiClient.suggestRules(location);
      setRules(response.rules);
      toast({
        title: 'Success',
        description: 'Alert rules generated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate rules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Alert Rules Suggestions
        </CardTitle>
        <CardDescription>
          Get AI-powered suggestions for alert rules based on camera location
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Camera Location</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Front Door, Parking Lot, Backyard"
              onKeyPress={(e) => e.key === 'Enter' && generateRules()}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={generateRules} disabled={loading || !location.trim()} className="w-full sm:w-auto">
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="scale-75 brightness-0 invert">
                    <MessageLoading />
                  </div>
                  <span>Generating...</span>
                </div>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Generate Rules</span>
                  <span className="sm:hidden">Generate</span>
                </>
              )}
            </Button>
          </div>
        </div>
        {rules.length > 0 && (
          <div className="space-y-2">
            <Label>Suggested Rules:</Label>
            <div className="space-y-2">
              {rules.map((rule, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row items-start gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm flex-1 min-w-0">{rule}</p>
                  <Button variant="ghost" size="sm" className="w-full sm:w-auto self-end sm:self-auto">
                    Use Rule
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        {!rules.length && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Enter a camera location to get AI-suggested alert rules</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

