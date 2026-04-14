'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient, Event } from '@/lib/api';
import { Search } from 'lucide-react';
import { MessageLoading } from '@/components/ui/message-loading';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const OBJECT_TYPES = [
  'person', 'Hammer', 'axe', 'cricket bat', 'handgun', 
  'knife', 'sickle', 'mobile', 'Face mask'
];

export function AdvancedSearch({ onResults }: { onResults: (events: Event[]) => void }) {
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    objects: [] as string[],
    detectionType: '',
    location: '',
    startDate: '',
    endDate: '',
    minConfidence: '',
  });
  const { toast } = useToast();

  const handleSearch = async () => {
    setLoading(true);
    try {
      const searchParams: any = {};
      
      if (filters.objects.length > 0) {
        searchParams.objects = filters.objects;
      }
      if (filters.detectionType && filters.detectionType !== 'all') {
        searchParams.detectionType = filters.detectionType;
      }
      if (filters.location) {
        searchParams.location = filters.location;
      }
      if (filters.startDate) {
        searchParams.startDate = new Date(filters.startDate).toISOString();
      }
      if (filters.endDate) {
        searchParams.endDate = new Date(filters.endDate).toISOString();
      }
      if (filters.minConfidence) {
        searchParams.minConfidence = parseFloat(filters.minConfidence);
      }

      const response = await apiClient.searchEvents(searchParams);
      onResults(response.events);
      toast({
        title: 'Search Complete',
        description: `Found ${response.total} events`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to search events',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleObject = (obj: string) => {
    setFilters((prev) => ({
      ...prev,
      objects: prev.objects.includes(obj)
        ? prev.objects.filter((o) => o !== obj)
        : [...prev.objects, obj],
    }));
  };

  const resetFilters = () => {
    setFilters({
      objects: [],
      detectionType: '',
      location: '',
      startDate: '',
      endDate: '',
      minConfidence: '',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Advanced Search
        </CardTitle>
        <CardDescription>
          Search and filter detection events with multiple criteria
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Detection Type</Label>
            <Select
              value={filters.detectionType || undefined}
              onValueChange={(v) => setFilters({ ...filters, detectionType: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="object">Objects</SelectItem>
                <SelectItem value="anomaly">Anomalies</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              placeholder="Filter by location"
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Min Confidence</Label>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.1"
              placeholder="0.0 - 1.0"
              value={filters.minConfidence}
              onChange={(e) => setFilters({ ...filters, minConfidence: e.target.value })}
            />
          </div>
        </div>
        {filters.detectionType !== 'anomaly' && (
          <div className="space-y-2">
            <Label>Object Types</Label>
            <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto border rounded-lg p-2">
              {OBJECT_TYPES.map((obj) => (
                <div key={obj} className="flex items-center space-x-2">
                  <Checkbox
                    id={obj}
                    checked={filters.objects.includes(obj)}
                    onCheckedChange={() => toggleObject(obj)}
                  />
                  <Label htmlFor={obj} className="text-sm font-normal cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap">
                    {obj}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={handleSearch} disabled={loading} className="flex-1">
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="scale-75 brightness-0 invert">
                  <MessageLoading />
                </div>
                <span>Searching...</span>
              </div>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search
              </>
            )}
          </Button>
          <Button variant="outline" onClick={resetFilters}>
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

