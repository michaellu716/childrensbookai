import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RegeneratePageButtonProps {
  storyId: string;
  pageNumber: number;
  onSuccess?: () => void;
}

export const RegeneratePageButton = ({ storyId, pageNumber, onSuccess }: RegeneratePageButtonProps) => {
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-page-image', {
        body: {
          storyId,
          pageNumber
        }
      });

      if (error) {
        console.error('Error regenerating image:', error);
        toast.error(`Failed to regenerate image: ${error.message}`);
        return;
      }

      if (data?.success) {
        toast.success(`Page ${pageNumber} image regenerated successfully!`);
        onSuccess?.();
      } else {
        toast.error(`Failed to regenerate image for page ${pageNumber}`);
      }
    } catch (error) {
      console.error('Error regenerating image:', error);
      toast.error('Failed to regenerate image');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRegenerate}
      disabled={isRegenerating}
    >
      {isRegenerating ? (
        <>
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          Regenerating...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4 mr-2" />
          Regenerate Image
        </>
      )}
    </Button>
  );
};