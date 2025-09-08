import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Download, Share2, Edit, Loader2, RefreshCw, AlertCircle, Save, X } from 'lucide-react';
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
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const POLL_INTERVAL = 5000;
  const pollTimeoutRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);
  const edgeFnDisabledUntilRef = useRef<number | null>(null);

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

      // Try edge function first unless temporarily disabled by prior QUIC/network errors
      const now = Date.now();
      if (!edgeFnDisabledUntilRef.current || now >= edgeFnDisabledUntilRef.current) {
        try {
          console.log('Calling get-story-details function with storyId:', storyId);
          const { data: fnData, error: fnError } = await supabase.functions.invoke('get-story-details', {
            body: { storyId }
          });
          console.log('Edge function response:', { hasData: !!fnData, hasError: !!fnError });
          if (!fnError && fnData && (fnData as any).story) {
            const s = (fnData as any).story as any;
            const p = ((fnData as any).pages || []) as any[];
            const g = ((fnData as any).generations || []) as any[];

            setStory(s);
            setPages(p);
            setGenerations(g);

            const estimatedTotal = Number(s.length || p.length || 0);
            setTotalCount(estimatedTotal);
            const completed = p.filter(pg => !!pg.image_url).length;
            setCompletedCount(completed);

            if (s.status === 'generating') {
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
            return; // Skip direct table queries when function succeeds
          } else if (fnError) {
            const msg = String((fnError as any)?.message || (fnError as any));
            console.warn('get-story-details error:', msg);
            if (msg.includes('QUIC') || msg.includes('Failed to fetch') || msg.includes('network')) {
              edgeFnDisabledUntilRef.current = Date.now() + 5 * 60 * 1000; // 5 minutes
              console.warn('Disabling edge function usage for 5 minutes due to network transport errors.');
            }
          }
        } catch (e: any) {
          const msg = String(e?.message || e);
          console.warn('Edge function fetch failed, falling back to direct queries:', msg);
          if (msg.includes('QUIC') || msg.includes('Failed to fetch') || msg.includes('network')) {
            edgeFnDisabledUntilRef.current = Date.now() + 5 * 60 * 1000; // 5 minutes
            console.warn('Disabling edge function usage for 5 minutes due to network transport errors.');
          }
        }
      } else {
        console.log('Edge function temporarily disabled; using direct Supabase queries.');
      }
      
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

      // Fetch story pages with exponential backoff for QUIC errors
      let pagesData = [];
      let pagesAttempt = 0;
      const maxPageRetries = 8; // Increased for QUIC protocol issues
      
      while (pagesAttempt < maxPageRetries) {
        try {
          // Add random jitter to prevent thundering herd
          if (pagesAttempt > 0) {
            const baseDelay = Math.min(1000 * Math.pow(2, pagesAttempt - 1), 10000);
            const jitter = Math.random() * 1000;
            const delay = baseDelay + jitter;
            console.log(`Pages fetch failed (attempt ${pagesAttempt}), retrying in ${Math.round(delay)}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const { data, error } = await supabase
            .from('story_pages')
            .select('id, page_number, page_type, text_content, image_url, image_prompt')
            .eq('story_id', storyId)
            .order('page_number');

          if (error) throw error;
          pagesData = data || [];
          console.log(`Successfully fetched ${pagesData.length} pages on attempt ${pagesAttempt + 1}`);
          break;
        } catch (err) {
          pagesAttempt++;
          const errMsg = String(err.message || err);
          const isQuicError = errMsg.includes('QUIC') || errMsg.includes('ERR_QUIC_PROTOCOL_ERROR');
          const isNetworkError = errMsg.includes('Failed to fetch') || 
                                errMsg.includes('network') || 
                                errMsg.includes('timeout') ||
                                isQuicError;
          
          console.warn(`Pages fetch attempt ${pagesAttempt} failed:`, errMsg);
          
          if (pagesAttempt < maxPageRetries && isNetworkError) {
            // For QUIC errors, use longer delays
            if (isQuicError && pagesAttempt >= 3) {
              console.log('QUIC protocol error detected, using extended delay');
            }
            continue;
          }
          
          // Final attempt failed, but don't throw - allow partial loading
          console.error('All pages fetch attempts failed:', errMsg);
          pagesData = [];
          break;
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
      setEditingPageId(null); // Reset editing state when navigating
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setEditingPageId(null); // Reset editing state when navigating
    }
  };

  const startEditing = (pageId: string, currentText: string) => {
    setEditingPageId(pageId);
    setEditingText(currentText);
  };

  const cancelEditing = () => {
    setEditingPageId(null);
    setEditingText('');
  };

  const savePageText = async () => {
    if (!editingPageId) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('story_pages')
        .update({ text_content: editingText.trim() })
        .eq('id', editingPageId);

      if (error) throw error;

      // Update the local state
      setPages(prevPages => 
        prevPages.map(page => 
          page.id === editingPageId 
            ? { ...page, text_content: editingText.trim() }
            : page
        )
      );

      toast.success('Page text updated successfully!');
      setEditingPageId(null);
      setEditingText('');
    } catch (error) {
      console.error('Error saving page text:', error);
      toast.error('Failed to save page text');
    } finally {
      setIsSaving(false);
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

  const handleDownloadPDF = async () => {
    if (!story) return;
    
    setIsDownloadingPDF(true);
    try {
      const response = await supabase.functions.invoke('generate-story-pdf', {
        body: { storyId: story.id }
      });

      if (response.error) {
        console.error('Error generating PDF:', response.error);
        toast.error('Failed to generate PDF');
      } else if (response.data?.pdfUrl) {
        // Download the PDF
        const link = document.createElement('a');
        link.href = response.data.pdfUrl;
        link.download = response.data.filename || `${story.title}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('PDF downloaded successfully!');
      }
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toast.error('Failed to download PDF');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const handleShare = () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Share link copied to clipboard!');
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
              {editingPageId === currentPageData.id ? (
                <div className="space-y-4">
                  <Textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="min-h-[120px] text-lg"
                    placeholder="Enter page text..."
                    maxLength={2000}
                    disabled={story?.status === 'generating'}
                  />
                  <div className="flex justify-center gap-2">
                    <Button 
                      onClick={savePageText} 
                      disabled={isSaving || editingText.trim() === currentPageData.text_content}
                      size="sm"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={cancelEditing}
                      size="sm"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {editingText.length}/2000 characters
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-lg leading-relaxed text-center">
                    {currentPageData.text_content}
                  </p>
                  
                  {/* Edit button for text */}
                  <div className="flex justify-center mt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => startEditing(currentPageData.id, currentPageData.text_content)}
                      disabled={story?.status === 'generating'}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Text
                    </Button>
                  </div>
                </>
              )}
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
        <Button variant="outline" onClick={handleDownloadPDF} disabled={isDownloadingPDF}>
          {isDownloadingPDF ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Download PDF
        </Button>
        <Button variant="outline" onClick={handleShare}>
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