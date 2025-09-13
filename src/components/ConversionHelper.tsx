import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { convertStorageToBase64, checkConversionStatus } from '@/utils/convertStorageToBase64';
import { toast } from 'sonner';

interface ConversionStatus {
  totalPages: number;
  base64Pages: number;
  storagePages: number;
  needsConversion: number;
}

export const ConversionHelper = () => {
  const [isConverting, setIsConverting] = useState(false);
  const [status, setStatus] = useState<ConversionStatus | null>(null);
  const [lastConversion, setLastConversion] = useState<{
    converted: number;
    failed: number;
    remaining: number;
  } | null>(null);

  const checkStatus = async () => {
    const statusData = await checkConversionStatus();
    setStatus(statusData);
  };

  const runConversion = async () => {
    setIsConverting(true);
    try {
      const result = await convertStorageToBase64();
      
      if (result.success) {
        toast.success(result.message);
        setLastConversion({
          converted: result.converted,
          failed: result.failed,
          remaining: result.remaining
        });
        
        // Refresh status after conversion
        await checkStatus();
        
        // If there are remaining items, offer to run again
        if (result.remaining > 0) {
          toast.info(`${result.remaining} pages still need conversion. Click "Run Conversion" again to continue.`);
        } else {
          toast.success('All storage URLs have been converted to base64!');
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to run conversion');
      console.error('Conversion error:', error);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Image Storage Conversion</h3>
        <Button variant="outline" size="sm" onClick={checkStatus}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Check Status
        </Button>
      </div>
      
      {status && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{status.base64Pages}</div>
              <div className="text-sm text-muted-foreground">Base64 Images</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{status.storagePages}</div>
              <div className="text-sm text-muted-foreground">Storage URLs</div>
            </div>
          </div>
          
          <div className="flex items-center justify-center space-x-2">
            <Badge variant={status.needsConversion > 0 ? "destructive" : "secondary"}>
              {status.needsConversion} need conversion
            </Badge>
            <Badge variant="outline">
              {status.totalPages} total pages
            </Badge>
          </div>
        </div>
      )}

      {lastConversion && (
        <div className="bg-muted/50 p-3 rounded-lg">
          <div className="text-sm font-medium mb-2">Last Conversion Results:</div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              {lastConversion.converted} converted
            </div>
            <div className="flex items-center text-red-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              {lastConversion.failed} failed
            </div>
            <div className="flex items-center text-orange-600">
              <RefreshCw className="h-3 w-3 mr-1" />
              {lastConversion.remaining} remaining
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-2">
        <Button 
          onClick={runConversion} 
          disabled={isConverting || (status?.needsConversion === 0)}
          className="flex-1"
        >
          {isConverting ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Converting...
            </>
          ) : (
            'Run Conversion'
          )}
        </Button>
      </div>
      
      <div className="text-xs text-muted-foreground">
        This tool converts existing storage URLs to base64 format for consistent image handling.
        Run the conversion in batches if you have many images.
      </div>
    </Card>
  );
};