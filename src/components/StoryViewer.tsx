import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, Download, Share2, Edit, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StoryPage {
  id: string;
  page_number: number;
  page_type: string;
  text_content: string;
  image_url?: string;
  image_prompt?: string;
}

interface StoryGeneration {
  id: string;
  generation_type: string;
  status: string;
  error_message?: string;
  created_at: string;
}

interface Story {
  id: string;
  title: string;
  status: string;
  length: number;
  art_style: string;
  child_name: string;
  pages?: StoryPage[];
}

interface StoryViewerProps {
  storyId: string;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({ storyId }) => {
  const [story, setStory] = useState<Story | null>(null);
  const [pages, setPages] = useState<StoryPage[]>([]);
  const [generations, setGenerations] = useState<StoryGeneration[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [retryingIllustrations, setRetryingIllustrations] = useState(false);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);

  const POLL_INTERVAL = 5000;
  const pollTimeoutRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    fetchStory();
  }, [storyId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  const fetchStory = async (retryCount = 0) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      console.log(`Fetching story (attempt ${retryCount + 1})`);
      
      // Fetch story details with aggressive retry for network failures
      let storyData = null;
      let storyAttempt = 0;
      while (storyAttempt < 3) {
        try {
          const { data, error } = await supabase
            .from('stories')
            .select('*')
            .eq('id', storyId)
            .maybeSingle();

          if (error) throw error;
          storyData = data;
          break;
        } catch (err) {
          storyAttempt++;
          const isNetworkError = String(err.message).includes('Failed to fetch') || 
                                String(err.message).includes('QUIC') ||
                                String(err.message).includes('network');
          
          if (storyAttempt < 3 && isNetworkError) {
            console.log(`Story fetch failed, retrying in ${1000 * storyAttempt}ms`);
            await new Promise(resolve => setTimeout(resolve, 1000 * storyAttempt));
            continue;
          }
          throw err;
        }
      }

      if (!storyData) {
        setStory(null);
        setPages([]);
        setGenerations([]);
        setIsPolling(false);
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
        setIsLoading(false);
        return;
      }

      // Fetch character sheet with retry
      let characterSheet = null;
      if (storyData.character_sheet_id) {
        let charAttempt = 0;
        while (charAttempt < 2) {
          try {
            const { data } = await supabase
              .from('character_sheets')
              .select('name, hair_color, hair_style, eye_color, skin_tone, typical_outfit, cartoon_reference_url')
              .eq('id', storyData.character_sheet_id)
              .maybeSingle();
            characterSheet = data;
            break;
          } catch (err) {
            charAttempt++;
            const isNetworkError = String(err.message).includes('Failed to fetch') || 
                                  String(err.message).includes('QUIC');
            if (charAttempt < 2 && isNetworkError) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            console.warn('Failed to fetch character sheet:', err);
            break;
          }
        }
      }

      // Fetch story pages with aggressive retry
      let pagesData = [];
      let pagesAttempt = 0;
      while (pagesAttempt < 5) {
        try {
          const { data, error } = await supabase
            .from('story_pages')
            .select('id, page_number, page_type, text_content, image_url, image_prompt')
            .eq('story_id', storyId)
            .order('page_number');

          if (error) throw error;
          pagesData = data || [];
          console.log(`Successfully fetched ${pagesData.length} pages`);
          break;
        } catch (err) {
          pagesAttempt++;
          const isNetworkError = String(err.message).includes('Failed to fetch') || 
                                String(err.message).includes('QUIC') ||
                                String(err.message).includes('network');
          
          if (pagesAttempt < 5 && isNetworkError) {
            const delay = Math.min(1000 * pagesAttempt, 5000);
            console.log(`Pages fetch failed (attempt ${pagesAttempt}), retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw err;
        }
      }

      // Fetch generations with retry
      let generationsData = [];
      let genAttempt = 0;
      while (genAttempt < 2) {
        try {
          const { data, error } = await supabase
            .from('story_generations')
            .select('id, generation_type, status, error_message, created_at')
            .eq('story_id', storyId)
            .order('created_at', { ascending: false });

          if (error) console.error('Error fetching generations:', error);
          else generationsData = data || [];
          break;
        } catch (err) {
          genAttempt++;
          const isNetworkError = String(err.message).includes('Failed to fetch') || 
                                String(err.message).includes('QUIC');
          if (genAttempt < 2 && isNetworkError) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          console.warn('Failed to fetch generations:', err);
          break;
        }
      }

      // Update state
      const storyWithCharacter = characterSheet 
        ? { ...storyData, character_sheets: characterSheet }
        : { ...storyData, character_sheets: null };

      setStory(storyWithCharacter);
      setPages(pagesData);
      setGenerations(generationsData);

      // Update progress counts (lightweight HEAD count for accuracy during generation)
      try {
        const estimatedTotal = Number(storyWithCharacter.length || pagesData.length || 0);
        setTotalCount(estimatedTotal);

        const { count: headCompleted } = await supabase
          .from('story_pages')
          .select('id', { count: 'exact', head: true })
          .eq('story_id', storyId)
          .not('image_url', 'is', null);

        const fallbackCompleted = pagesData.filter(p => !!p.image_url).length;
        setCompletedCount(typeof headCompleted === 'number' ? headCompleted : fallbackCompleted);
      } catch (e) {
        console.warn('Count query failed, using fallback:', e);
        setCompletedCount(pagesData.filter(p => !!p.image_url).length);
        setTotalCount(Number(storyWithCharacter.length || pagesData.length || 0));
      }

      // Polling control
      if (storyWithCharacter.status === 'generating') {
        setIsPolling(true);
        if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = window.setTimeout(() => {
          if (!isMountedRef.current) return;
          fetchStory();
        }, POLL_INTERVAL);
      } else {
        setIsPolling(false);
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
      }

      setIsLoading(false);

    } catch (error: any) {
      console.error('Error fetching story:', error);
      
      const msg = String(error?.message || error?.code || 'unknown');
      const isTransient = msg.includes('timeout') || 
                         msg.includes('57014') || 
                         msg.includes('Failed to fetch') ||
                         msg.includes('QUIC') ||
                         msg.includes('network');

      if (isTransient && retryCount < 2 && isMountedRef.current) {
        const retryDelay = Math.min(3000 * (retryCount + 1), 8000);
        console.log(`Final retry in ${retryDelay}ms (attempt ${retryCount + 1})`);
        
        if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = window.setTimeout(() => {
          if (!isMountedRef.current) return;
          fetchStory(retryCount + 1);
        }, retryDelay);
      } else {
        setIsPolling(false);
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
        setIsLoading(false);
        toast.error('Unable to load story due to network issues. Please refresh the page.');
      }
    } finally {
      isFetchingRef.current = false;
    }
  };

  const nextPage = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const regeneratePage = async (pageId: string) => {
    toast.info('Regenerating page illustration...');
    // This would call an edge function to regenerate a single page
  };

  const retryIllustrations = async () => {
    if (!story) return;
    
    setRetryingIllustrations(true);
    try {
      const response = await supabase.functions.invoke('retry-story-illustrations', {
        body: { storyId: story.id }
      });

      if (response.error) {
        console.error('Error retrying illustrations:', response.error);
        toast.error('Failed to retry illustrations');
      } else {
        toast.success('Retrying illustrations...');
        // Update story status to generating
        setStory(prev => prev ? { ...prev, status: 'generating' } : null);
        setIsPolling(true);
        // Refetch to get updated data
        fetchStory();
      }
    } catch (err) {
      console.error('Error retrying illustrations:', err);
      toast.error('Failed to retry illustrations');
    } finally {
      setRetryingIllustrations(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading your story...</span>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Story not found</p>
      </div>
    );
  }

  if (story.status === 'generating') {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
        <h3 className="text-xl font-semibold mb-2">Creating Your Story...</h3>
        <p className="text-muted-foreground mb-4">
          We're generating beautiful illustrations featuring {story.child_name}
        </p>
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm">
            {completedCount} of {totalCount} pages completed
          </p>
        </div>
        {isPolling && (
          <p className="text-xs text-muted-foreground mt-2">
            Checking for updates...
          </p>
        )}
      </Card>
    );
  }

  if (story.status === 'failed') {
    const latestError = generations.find(g => g.status === 'failed' && g.generation_type === 'illustrations');
    
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
        <h3 className="text-xl font-semibold mb-2 text-destructive">Generation Failed</h3>
        <p className="text-muted-foreground mb-4">
          We encountered an issue creating your story illustrations.
        </p>
        
        {latestError?.error_message && (
          <Alert className="mb-4 text-left">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error details:</strong> {latestError.error_message}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3 justify-center">
          <Button 
            onClick={retryIllustrations}
            disabled={retryingIllustrations}
          >
            {retryingIllustrations ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Illustrations
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/create'}>
            Create New Story
          </Button>
        </div>

        {/* Show story text if available */}
        {pages.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground mb-2">
              Story text was generated successfully:
            </p>
            <h4 className="text-lg font-semibold mb-2">{story.title}</h4>
            <div className="text-sm text-left bg-muted/50 p-3 rounded">
              {pages.map((page, index) => (
                <p key={page.id} className="mb-2">
                  <strong>Page {page.page_number}:</strong> {page.text_content}
                </p>
              ))}
            </div>
          </div>
        )}
      </Card>
    );
  }

  const currentPageData = pages[currentPage];

  return (
    <div className="space-y-6">
      {/* Story Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">{story.title}</h1>
        <div className="flex justify-center gap-2 mb-4">
          <Badge variant="secondary">{story.art_style}</Badge>
          <Badge variant="secondary">{story.length} pages</Badge>
          <Badge variant="secondary">Featuring {story.child_name}</Badge>
        </div>
      </div>

      {/* Page Display */}
      {currentPageData && (
        <Card className="overflow-hidden">
          <div className="aspect-[4/3] bg-gradient-to-br from-primary/10 to-secondary/10 relative">
            {currentPageData.image_url ? (
              <img
                src={currentPageData.image_url}
                alt={`Page ${currentPageData.page_number}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Generating illustration...
                  </p>
                </div>
              </div>
            )}
            
            {/* Page Number Indicator */}
            <div className="absolute top-4 right-4 bg-black/60 text-white px-2 py-1 rounded">
              {currentPageData.page_number} / {pages.length}
            </div>
          </div>
          
          {/* Text Content */}
          {currentPageData.text_content && (
            <div className="p-6 bg-background">
              <p className="text-lg leading-relaxed text-center">
                {currentPageData.text_content}
              </p>
              
              {/* Edit button for text */}
              <div className="flex justify-center mt-4">
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Text
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={prevPage}
          disabled={currentPage === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        
        <div className="flex gap-2">
          {pages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`w-3 h-3 rounded-full transition-colors ${
                index === currentPage
                  ? 'bg-primary'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
            />
          ))}
        </div>
        
        <Button
          variant="outline"
          onClick={nextPage}
          disabled={currentPage === pages.length - 1}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
        <Button variant="outline">
          <Share2 className="h-4 w-4 mr-2" />
          Share Story
        </Button>
        {currentPageData?.image_url && (
          <Button 
            variant="outline"
            onClick={() => regeneratePage(currentPageData.id)}
          >
            Regenerate Page
          </Button>
        )}
      </div>
    </div>
  );
};