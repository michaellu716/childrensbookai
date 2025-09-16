import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, FileText, Loader2 } from 'lucide-react';
import { usePaginatedPdfGeneration } from '@/hooks/usePaginatedPdfGeneration';
import { toast } from 'sonner';

interface PaginatedPdfGeneratorProps {
  storyId: string;
  storyTitle: string;
  pageLimit?: number;
}

export const PaginatedPdfGenerator = ({ 
  storyId, 
  storyTitle, 
  pageLimit = 3 
}: PaginatedPdfGeneratorProps) => {
  const { generatePaginatedPdf, isGenerating, progress, generatedFiles } = usePaginatedPdfGeneration();

  const handleGeneratePdf = async () => {
    toast.info('Starting paginated PDF generation...');
    
    const result = await generatePaginatedPdf(storyId, pageLimit);
    
    if (result.success) {
      toast.success(`Successfully generated ${result.files.length} PDF file(s)!`);
    } else {
      toast.error(`PDF generation failed: ${result.error}`);
    }
  };

  const downloadFile = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${storyTitle}_part${index + 1}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          PDF Export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleGeneratePdf} 
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Generate Paginated PDF
            </>
          )}
        </Button>

        {progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Batch {progress.currentBatch} of {progress.totalBatches}</span>
              <span>{progress.processedPages} / {progress.totalPages} pages</span>
            </div>
            <Progress 
              value={(progress.processedPages / progress.totalPages) * 100} 
              className="w-full" 
            />
          </div>
        )}

        {generatedFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Generated Files:</h4>
            {generatedFiles.map((url, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => downloadFile(url, index)}
                className="w-full justify-start"
              >
                <Download className="mr-2 h-4 w-4" />
                Part {index + 1}
              </Button>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Processing {pageLimit} pages per batch to avoid timeouts
        </div>
      </CardContent>
    </Card>
  );
};