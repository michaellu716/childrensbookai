import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Download, Share2, Edit, Loader2, RefreshCw, AlertCircle, Save, X, Play, Pause, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import '../utils/regenerateMissingImage'; // Import utility for console access

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
  isPublicView?: boolean;
}

// Enhanced image component that loads images lazily to avoid database timeouts
const StoryImage: React.FC<{ 
  pageId: string;
  pageNumber: number;
  storyId: string;
  alt?: string;
}> = ({ pageId, pageNumber, storyId, alt = "Story page" }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        setLoading(true);
        const response = await supabase.functions.invoke('get-page-image', {
          body: { pageId }
        });

        if (response.error) {
          console.error('Error loading image:', response.error);
          setImageError(true);
        } else {
          if (response.data?.image_url) {
            setImageUrl(response.data.image_url);
          } else {
            // Simply show error instead of auto-generating to save OpenAI credits
            setImageError(true);
          }
        }
      } catch (err) {
        console.error('Error loading image:', err);
        setImageError(true);
      } finally {
        setLoading(false);
      }
    };

    const generatePageImage = async () => {
      try {
        setGenerating(true);
        console.log(`Auto-generating image for page ${pageNumber}...`);
        
        const response = await supabase.functions.invoke('generate-page-image', {
          body: { 
            storyId: storyId,
            pageNumber: pageNumber
          }
        });

        if (response.error) {
          console.error('Error generating image:', response.error);
          setImageError(true);
        } else {
          console.log('Image generated successfully:', response.data);
          setImageUrl(response.data?.imageUrl);
          // Refresh to get the new image
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (err) {
        console.error('Error generating image:', err);
        setImageError(true);
      } finally {
        setGenerating(false);
      }
    };

    loadImage();
  }, [pageId, pageNumber, storyId]);

  if (loading || generating) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-50 to-white dark:from-gray-800 dark:via-gray-700 dark:to-gray-600 flex flex-col items-center justify-center p-8 border border-gray-200 dark:border-gray-600 rounded-xl animate-pulse">
        <div className="h-12 w-12 bg-gray-300 dark:bg-gray-600 rounded-full mb-4"></div>
        <span className="text-lg text-muted-foreground font-medium">
          {generating ? `Generating image for page ${pageNumber}...` : 'Loading image...'}
        </span>
      </div>
    );
  }

  if (!imageUrl || imageError) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-50 to-white dark:from-gray-800 dark:via-gray-700 dark:to-gray-600 flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4 animate-pulse" />
        <div className="flex flex-col gap-3">
          <span className="text-lg text-muted-foreground font-medium">Image not available</span>
          <p className="text-sm text-muted-foreground text-center">
            This page's illustration is currently unavailable
          </p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
      onError={() => setImageError(true)}
    />
  );
};

export const StoryViewer: React.FC<StoryViewerProps> = ({ storyId, isPublicView = false }) => {
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
  
  
  // Text-to-speech with auto-advance callback
  const { speak, stop, pause, resume, isSupported: ttsSupported, isPlaying: ttsPlaying, isPaused: ttsPaused, voices } = useTextToSpeech({
    rate: 0.85,
    pitch: 0.95,
    volume: 1,
    onSpeechEnd: () => {
      // Auto-advance to next page when TTS finishes, with a smooth delay
      console.log('TTS finished, auto-advancing to next page');
      setTimeout(() => {
        const totalPages = pages.length + 1;
        if (currentPage < totalPages - 1) {
          setCurrentPage(prev => prev + 1);
          setHasUserNavigated(true);
        }
      }, 1200); // 1.2 second delay for better UX
    }
  });
  
  const [hasUserNavigated, setHasUserNavigated] = useState(false);

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

  useEffect(() => {
    const handleRetryImages = async () => {
      if (!story) return;
      
      setRetryingIllustrations(true);
      try {
        console.log('Calling regenerate-story-images function...');
        const response = await supabase.functions.invoke('regenerate-story-images', {
          body: { storyId: story.id }
        });

        if (response.error) {
          console.error('Error regenerating images:', response.error);
          toast.error('Failed to regenerate images');
        } else {
          console.log('Image regeneration response:', response.data);
          toast.success('Images are being regenerated...');
          // Update story status and refetch
          setStory(prev => prev ? { ...prev, status: 'generating' } : null);
          setIsPolling(true);
          fetchStory();
        }
      } catch (err) {
        console.error('Error calling regenerate function:', err);
        toast.error('Failed to start image regeneration');
      } finally {
        setRetryingIllustrations(false);
      }
    };

    const handleGeneratePageImage = async () => {
      if (!story || !pages[currentPage]) return;
      
      setRetryingIllustrations(true);
      try {
        const currentPageData = pages[currentPage];
        console.log(`Generating image for page ${currentPageData.page_number}...`);
        
        const response = await supabase.functions.invoke('generate-page-image', {
          body: { 
            storyId: story.id,
            pageNumber: currentPageData.page_number
          }
        });

        if (response.error) {
          console.error('Error generating page image:', response.error);
          toast.error('Failed to generate page image');
        } else {
          console.log('Page image generation response:', response.data);
          toast.success('Page image generated successfully!');
          // Refetch story to get updated image
          fetchStory();
        }
      } catch (err) {
        console.error('Error calling generate-page-image function:', err);
        toast.error('Failed to generate page image');
      } finally {
        setRetryingIllustrations(false);
      }
    };

    window.addEventListener('retryStoryImages', handleRetryImages);
    window.addEventListener('generatePageImage', handleGeneratePageImage);
    
    return () => {
      window.removeEventListener('retryStoryImages', handleRetryImages);
      window.removeEventListener('generatePageImage', handleGeneratePageImage);
    };
  }, [story, pages, currentPage]);

  // Auto-play text when page changes
  useEffect(() => {
    if (ttsSupported && pages.length > 0 && pages[currentPage]?.text_content && story?.status !== 'generating' && hasUserNavigated) {
      console.log('Auto-play triggered for page:', currentPage, pages[currentPage]?.text_content?.substring(0, 50));
      
      // Small delay to ensure page transition is smooth
      const timer = setTimeout(() => {
        speak(pages[currentPage].text_content);
      }, 800);
      
      return () => {
        console.log('Cleaning up auto-play timer');
        clearTimeout(timer);
      };
    }
  }, [currentPage, pages, ttsSupported, story?.status, hasUserNavigated]); // Added hasUserNavigated to dependencies

  // Reset autoplay guard when story changes
  useEffect(() => {
    const handleRetryImages = () => {
      retryIllustrations();
    };

    window.addEventListener('retryStoryImages', handleRetryImages);
    return () => window.removeEventListener('retryStoryImages', handleRetryImages);
  }, [story]);

  useEffect(() => {
    setHasUserNavigated(false);
    stop();
  }, [storyId]);

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
            // For lazy loading, assume all pages are completed if story status is completed
            const completed = s.status === 'completed' ? p.length : p.filter(pg => !!pg.image_url).length;
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

        // For lazy loading, if story is completed, assume all pages are completed
        if (storyWithCharacter.status === 'completed') {
          setCompletedCount(pagesData.length);
        } else {
          const { count: headCompleted } = await supabase
            .from('story_pages')
            .select('id', { count: 'exact', head: true })
            .eq('story_id', storyId)
            .not('image_url', 'is', null);

          const fallbackCompleted = pagesData.filter(p => !!p.image_url).length;
          setCompletedCount(typeof headCompleted === 'number' ? headCompleted : fallbackCompleted);
        }
      } catch (e) {
        console.warn('Count query failed, using fallback:', e);
        // For lazy loading, if story is completed, assume all pages are completed
        const fallbackCompleted = storyWithCharacter.status === 'completed' ? pagesData.length : pagesData.filter(p => !!p.image_url).length;
        setCompletedCount(fallbackCompleted);
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
    const totalPages = pages.length + 1; // Include "The End" page
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
      setEditingPageId(null); // Reset editing state when navigating
      setHasUserNavigated(true); // Mark as user navigation
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setEditingPageId(null); // Reset editing state when navigating
      setHasUserNavigated(true); // Mark as user navigation
    }
  };


  const startEditing = (pageId: string, currentText: string | null | undefined) => {
    console.log('[StoryViewer] Start editing page', { pageId });
    setEditingPageId(pageId);
    setEditingText(currentText ?? '');
  };

  const cancelEditing = () => {
    console.log('[StoryViewer] Cancel editing');
    setEditingPageId(null);
    setEditingText('');
  };

  const savePageText = async () => {
    if (!editingPageId) return;
    console.log('[StoryViewer] Saving page text', { editingPageId, length: editingText.length });
    
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
      const response = await supabase.functions.invoke('regenerate-story-images', {
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

        {/* Action buttons - Only show for authenticated users */}
        {!isPublicView && (
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
        )}

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
  const isEndPage = currentPage >= pages.length;
  const totalPages = pages.length + 1; // Add 1 for "The End" page

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Story Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground tracking-wide bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">{story.title}</h1>
        <div className="flex justify-center gap-3">
          <Badge variant="secondary" className="px-4 py-2 rounded-full font-medium bg-gradient-to-r from-yellow-200 to-orange-200 text-orange-800 border-0">{story.art_style}</Badge>
          <Badge variant="secondary" className="px-4 py-2 rounded-full font-medium bg-gradient-to-r from-green-200 to-emerald-200 text-emerald-800 border-0">{story.length} pages</Badge>
          <Badge variant="secondary" className="px-4 py-2 rounded-full font-medium bg-gradient-to-r from-purple-200 to-pink-200 text-purple-800 border-0">Featuring {story.child_name}</Badge>
        </div>
      </div>

      {/* Children's Book Display */}
      <div className="relative">
        {/* Book Shadow */}
        <div className="absolute inset-x-6 bottom-2 h-6 bg-gradient-to-t from-black/15 to-transparent blur-2xl rounded-full" />
        
        <div className="relative bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-pink-900/20 rounded-3xl shadow-2xl border-4 border-white dark:border-gray-700 overflow-hidden transform-gpu max-w-7xl mx-auto">
          {/* Colorful Book Spine */}
          <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-b from-red-400 via-orange-400 via-yellow-400 via-green-400 via-blue-400 via-indigo-400 to-purple-400 shadow-inner" />
          <div className="absolute left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-red-300 to-purple-300 opacity-60" />
          
          {isEndPage ? (
            /* The End Page */
            <div className="min-h-[700px] p-16 flex items-center justify-center bg-gradient-to-br from-yellow-100 via-pink-100 to-purple-100 dark:from-yellow-900/20 dark:via-pink-900/20 dark:to-purple-900/20 relative">
              <div className="text-center space-y-10">
                <div className="text-9xl mb-8 animate-bounce">🎉</div>
                <h2 className="text-6xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent mb-8 tracking-wide">The End</h2>
                <p className="text-2xl text-gray-700 dark:text-gray-300 font-medium max-w-lg mx-auto leading-relaxed">
                  We hope you enjoyed {story.child_name}'s magical adventure!
                </p>
                <div className="mt-16 text-4xl space-x-3">
                  <span className="animate-pulse inline-block">🌟</span>
                  <span className="animate-pulse inline-block animation-delay-200">✨</span>
                  <span className="animate-pulse inline-block animation-delay-400">🌟</span>
                </div>
              </div>
              
              {/* Page Number Bottom Right */}
              <div className="absolute bottom-6 right-8 text-lg font-bold text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg border-2 border-purple-200 dark:border-purple-600">
                {totalPages}
              </div>
            </div>
          ) : currentPageData ? (
            <div className="min-h-[700px] flex flex-col lg:flex-row relative">
              {/* Image Side - Made wider to show more of the photo */}
              <div className="flex-[2] relative bg-gradient-to-br from-sky-100 via-cyan-50 to-blue-100 dark:from-sky-900/20 dark:via-cyan-900/20 dark:to-blue-900/20">
                <div className="relative h-full min-h-[350px] lg:min-h-[700px] p-8">
                  <div className="h-full rounded-2xl overflow-hidden shadow-xl border-4 border-white dark:border-gray-600 bg-white dark:bg-gray-800">
                    <StoryImage
                      pageId={currentPageData.id}
                      pageNumber={currentPageData.page_number}
                      storyId={story.id}
                      alt={`Page ${currentPageData.page_number}`}
                    />
                  </div>
                </div>
              </div>
              
              {/* Text Side - Made same width as image side */}
              {currentPageData.text_content && (
                <div className="flex-[2] relative bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 dark:from-yellow-900/20 dark:via-orange-900/20 dark:to-red-900/20">
                  {/* Decorative elements instead of lines */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-8 left-8 text-4xl text-pink-400">🌸</div>
                    <div className="absolute top-20 right-12 text-3xl text-blue-400">⭐</div>
                    <div className="absolute bottom-20 left-12 text-3xl text-green-400">🦋</div>
                    <div className="absolute bottom-8 right-16 text-4xl text-purple-400">🌈</div>
                  </div>
                  
                  <div className="relative p-8 lg:p-12 h-full flex flex-col justify-center">
                    {editingPageId === currentPageData.id ? (
                      <div className="space-y-6">
                        <Textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="min-h-[200px] text-xl font-medium bg-white/80 dark:bg-gray-800/80 border-4 border-purple-200 dark:border-purple-600 rounded-2xl resize-none focus:ring-4 focus:ring-purple-300/50 dark:focus:ring-purple-500/50"
                          placeholder="Enter page text..."
                          maxLength={2000}
                          disabled={story?.status === 'generating'}
                        />
                        <div className="flex justify-center gap-4">
                          <Button 
                            onClick={savePageText} 
                            disabled={isSaving || editingText.trim() === currentPageData.text_content}
                            className="px-8 py-3 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white transform hover:scale-105"
                          >
                            {isSaving ? (
                              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                            ) : (
                              <Save className="h-5 w-5 mr-3" />
                            )}
                            Save Changes
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={cancelEditing}
                            className="px-8 py-3 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 border-4 border-red-300 hover:bg-red-50 dark:border-red-600 dark:hover:bg-red-950/20 transform hover:scale-105"
                          >
                            <X className="h-5 w-5 mr-3" />
                            Cancel
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground text-center font-medium">
                          {editingText.length}/2000 characters
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <p className="text-2xl leading-relaxed font-medium text-gray-800 dark:text-gray-200 text-left bg-white/60 dark:bg-gray-800/60 p-6 rounded-2xl shadow-lg border-2 border-white dark:border-gray-600">
                          {currentPageData.text_content}
                        </p>
                        
                        {/* Playful Action Buttons */}
                        <div className="flex flex-wrap justify-center gap-4">
                          {/* Text-to-Speech Controls */}
                          {ttsSupported && (
                            <>
                              {!ttsPlaying ? (
                                <Button
                                  variant="outline"
                                  onClick={() => speak(currentPageData.text_content)}
                                  className="px-6 py-3 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 border-4 border-blue-300 hover:bg-blue-50 dark:border-blue-600 dark:hover:bg-blue-950/20 group transform hover:scale-105"
                                >
                                  <Play className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                                  Read Aloud
                                </Button>
                              ) : (
                                <div className="flex gap-3">
                                  {ttsPaused ? (
                                    <Button
                                      variant="outline"
                                      onClick={resume}
                                      className="px-4 py-3 rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all duration-300 border-4 border-green-300 hover:bg-green-50 dark:border-green-600 dark:hover:bg-green-950/20 transform hover:scale-105"
                                    >
                                      <Play className="h-5 w-5" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      onClick={pause}
                                      className="px-4 py-3 rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all duration-300 border-4 border-yellow-300 hover:bg-yellow-50 dark:border-yellow-600 dark:hover:bg-yellow-950/20 transform hover:scale-105"
                                    >
                                      <Pause className="h-5 w-5" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    onClick={stop}
                                    className="px-4 py-3 rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all duration-300 border-4 border-red-300 hover:bg-red-50 dark:border-red-600 dark:hover:bg-red-950/20 transform hover:scale-105"
                                  >
                                    <Square className="h-5 w-5" />
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                          
                          {/* Edit button for text - Only show for authenticated users */}
                          {!isPublicView && (
                            <Button 
                              variant="outline"
                              onClick={() => startEditing(currentPageData.id, currentPageData.text_content)}
                              disabled={story?.status === 'generating'}
                              className="px-6 py-3 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 border-4 border-purple-300 hover:bg-purple-50 dark:border-purple-600 dark:hover:bg-purple-950/20 group transform hover:scale-105"
                            >
                              <Edit className="h-5 w-5 mr-3 group-hover:rotate-12 transition-transform" />
                              Edit Text
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Page Number Bottom Right */}
              <div className="absolute bottom-6 right-8 text-lg font-bold text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg border-2 border-purple-200 dark:border-purple-600">
                {currentPageData.page_number}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Playful Navigation */}
      <div className="flex justify-between items-center px-6">
        <Button
          onClick={prevPage}
          disabled={currentPage === 0}
          className={`px-8 py-4 rounded-3xl font-bold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2 ${
            currentPage === 0 
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none hover:shadow-none hover:translate-y-0' 
              : 'bg-gradient-to-r from-pink-400 via-purple-500 to-indigo-500 hover:from-pink-500 hover:via-purple-600 hover:to-indigo-600 text-white'
          }`}
        >
          <ChevronLeft className="h-6 w-6 mr-3" />
          Previous Page
        </Button>
        
        {/* Colorful Page Indicators */}
        <div className="flex gap-4 px-8 py-3 bg-gradient-to-r from-yellow-100 via-pink-100 to-purple-100 dark:from-yellow-900/20 dark:via-pink-900/20 dark:to-purple-900/20 rounded-3xl backdrop-blur-sm border-4 border-white dark:border-gray-600 shadow-xl">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentPage(index);
                setHasUserNavigated(true);
              }}
              className={`relative w-5 h-5 rounded-full transition-all duration-300 hover:scale-150 transform ${
                index === currentPage
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-2xl scale-125'
                  : 'bg-gradient-to-r from-blue-300 to-green-300 hover:from-purple-300 hover:to-pink-300 shadow-lg'
              }`}
            >
              {index === currentPage && (
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 animate-ping opacity-75 scale-150" />
              )}
            </button>
          ))}
        </div>
        
        <Button
          onClick={nextPage}
          disabled={currentPage === totalPages - 1}
          className={`px-8 py-4 rounded-3xl font-bold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2 ${
            currentPage === totalPages - 1
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none hover:shadow-none hover:translate-y-0'
              : 'bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 hover:from-green-500 hover:via-blue-600 hover:to-purple-600 text-white'
          }`}
        >
          Next Page
          <ChevronRight className="h-6 w-6 ml-3" />
        </Button>
      </div>

      {/* Colorful Action Buttons - Only show for authenticated users */}
      {!isPublicView && (
        <div className="flex justify-center gap-8 pt-6">
          <Button 
            onClick={handleDownloadPDF} 
            disabled={isDownloadingPDF}
            className="px-10 py-4 rounded-3xl font-bold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2 bg-gradient-to-r from-orange-400 via-pink-500 to-red-500 hover:from-orange-500 hover:via-pink-600 hover:to-red-600 text-white group"
          >
            {isDownloadingPDF ? (
              <Loader2 className="h-6 w-6 mr-3 animate-spin" />
            ) : (
              <Download className="h-6 w-6 mr-3 group-hover:scale-110 transition-transform" />
            )}
            Download as PDF
          </Button>
          <Button 
            onClick={handleShare}
            className="px-10 py-4 rounded-3xl font-bold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 hover:from-blue-500 hover:via-purple-600 hover:to-pink-600 text-white group"
          >
            <Share2 className="h-6 w-6 mr-3 group-hover:scale-110 transition-transform" />
            Share Story
          </Button>
        </div>
      )}
    </div>
  );
};