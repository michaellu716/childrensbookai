import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaginationInfo {
  pageOffset: number;
  pageLimit: number;
  totalPages: number;
  hasMorePages: boolean;
  processedPages: number;
}

interface PdfGenerationResult {
  success: boolean;
  pdfUrl?: string;
  filename?: string;
  pagination?: PaginationInfo;
  error?: string;
}

export const usePaginatedPdfGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{
    currentBatch: number;
    totalBatches: number;
    processedPages: number;
    totalPages: number;
  } | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<string[]>([]);

  const generatePaginatedPdf = async (
    storyId: string,
    pageLimit = 3
  ): Promise<{ success: boolean; files: string[]; error?: string }> => {
    setIsGenerating(true);
    setProgress(null);
    setGeneratedFiles([]);

    try {
      let pageOffset = 0;
      let hasMorePages = true;
      const files: string[] = [];
      let totalPages = 0;
      let currentBatch = 1;

      while (hasMorePages) {
        console.log(`Generating PDF batch ${currentBatch}, offset: ${pageOffset}`);
        
        const { data, error } = await supabase.functions.invoke('generate-story-pdf', {
          body: {
            storyId,
            pageOffset,
            pageLimit
          }
        });

        if (error) {
          console.error('PDF generation error:', error);
          return { success: false, files, error: error.message };
        }

        const result = data as PdfGenerationResult;
        
        if (!result.success) {
          return { success: false, files, error: result.error || 'Unknown error' };
        }

        if (result.pdfUrl) {
          files.push(result.pdfUrl);
          setGeneratedFiles(prev => [...prev, result.pdfUrl!]);
        }

        if (result.pagination) {
          totalPages = result.pagination.totalPages;
          hasMorePages = result.pagination.hasMorePages;
          pageOffset = result.pagination.pageOffset + result.pagination.pageLimit;
          
          const totalBatches = Math.ceil(totalPages / pageLimit);
          setProgress({
            currentBatch,
            totalBatches,
            processedPages: result.pagination.pageOffset + result.pagination.processedPages,
            totalPages
          });
          
          currentBatch++;
        } else {
          hasMorePages = false;
        }

        // Small delay between batches to avoid overwhelming the server
        if (hasMorePages) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return { success: true, files };
    } catch (error) {
      console.error('Paginated PDF generation failed:', error);
      return { 
        success: false, 
        files: [], 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generatePaginatedPdf,
    isGenerating,
    progress,
    generatedFiles
  };
};