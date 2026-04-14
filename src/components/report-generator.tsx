'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api';
import { FileText, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MessageLoading } from '@/components/ui/message-loading';
// Using simple markdown rendering without external dependency

export function ReportGenerator() {
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateReport = async () => {
    setLoading(true);
    setReport(null);
    try {
      const response = await apiClient.generateReport(reportType);
      setReport(response.report);
      toast({
        title: 'Success',
        description: 'Report generated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate report',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${reportType}-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Security Report Generator
        </CardTitle>
        <CardDescription>
          Generate AI-powered security reports for your detection events
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select report type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily Report</SelectItem>
              <SelectItem value="weekly">Weekly Report</SelectItem>
              <SelectItem value="monthly">Monthly Report</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={generateReport} disabled={loading} className="w-full sm:w-auto h-10 px-6">
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="scale-75">
                  <MessageLoading />
                </div>
                <span>Generating...</span>
              </div>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Generate Report</span>
                <span className="sm:hidden">Generate</span>
              </>
            )}
          </Button>
        </div>
        {report && (
          <>
            <div className="flex justify-end mb-2">
              <Button variant="outline" size="sm" onClick={downloadReport}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
            <ScrollArea className="flex-1 border rounded-lg p-4">
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {report}
              </div>
            </ScrollArea>
          </>
        )}
        {!report && !loading && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a report type and click Generate Report</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

