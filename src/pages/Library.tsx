import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { BookOpen, Search, Plus, Download, Share, Trash2, Loader2, Printer, Users, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useReactToPrint } from 'react-to-print';
import { useStoriesQuery, type Story } from "@/hooks/useStoriesQuery";
import { StoryCard } from "@/components/StoryCard";
import { useQueryClient } from '@tanstack/react-query';
import { Footer } from "@/components/Footer";

const STORIES_PER_PAGE = 24;

const Library = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [storyContent, setStoryContent] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: stories = [], isLoading, error } = useStoriesQuery();

  useEffect(() => {
    if (error) {
      console.error('Error fetching stories:', error);
      toast.error('Failed to load your stories');
    }
  }, [error]);

  // Memoize expensive computations without side effects
  const { filteredStories, statusCounts, totalCharacters } = useMemo(() => {
    const lowerSearchQuery = searchQuery.toLowerCase();
    
    // Calculate status counts once
    const counts = {
      completed: 0,
      generating: 0,
      draft: 0,
      failed: 0
    };
    
    const uniqueCharacters = new Set<string>();
    
    const filtered = stories.filter(story => {
      // Count statuses while filtering
      if (story.status === "completed") counts.completed++;
      else if (story.status === "generating") counts.generating++;
      else if (story.status === "draft") counts.draft++;
      else if (story.status === "failed") counts.failed++;
      
      // Track unique characters
      if (story.child_name) uniqueCharacters.add(story.child_name);
      
      // Search matching
      const matchesSearch = !searchQuery || 
        story.title.toLowerCase().includes(lowerSearchQuery) ||
        story.child_name?.toLowerCase().includes(lowerSearchQuery) ||
        story.themes?.some(theme => theme.toLowerCase().includes(lowerSearchQuery));
      
      // Filter matching
      const matchesFilter = selectedFilter === "all" || story.status === selectedFilter;
      
      return matchesSearch && matchesFilter;
    });
    
    const sorted = filtered.slice().sort((a, b) => {
      const likeDiff = (b.likes || 0) - (a.likes || 0);
      if (likeDiff !== 0) return likeDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    return {
      filteredStories: sorted,
      statusCounts: counts,
      totalCharacters: uniqueCharacters.size
    };
  }, [stories, searchQuery, selectedFilter]);

  // Calculate pagination separately to avoid infinite loops
  const totalPages = Math.ceil(filteredStories.length / STORIES_PER_PAGE);
  
  // Reset to page 1 when filters change (in useEffect to avoid infinite renders)
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
    // Also normalize invalid page states when there are zero pages
    if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filteredStories.length, currentPage, totalPages]);

  // Calculate paginated results
  const paginatedStories = useMemo(() => {
    const startIndex = (currentPage - 1) * STORIES_PER_PAGE;
    const endIndex = startIndex + STORIES_PER_PAGE;
    return filteredStories.slice(startIndex, endIndex);
  }, [filteredStories, currentPage]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handlePrintStory = async (storyId: string, storyTitle: string) => {
    try {
      toast.info('Loading story content for printing...');
      
      // Fetch the story details including pages and illustrations
      const { data, error } = await supabase.functions.invoke('get-story-details', {
        body: { storyId }
      });

      if (error) throw error;
      
      if (data?.story && data?.pages) {
        // Transform the data to match what the print component expects
        const storyWithPages = {
          ...data.story,
          pages: data.pages.map((page: any) => ({
            ...page,
            content: page.text_content,
            illustration_url: page.image_url // This should now be available from the API
          }))
        };

        setStoryContent(storyWithPages);
        // Small delay to ensure content is rendered
        setTimeout(() => {
          handlePrint();
        }, 100);
      }
    } catch (error) {
      console.error('Error preparing story for print:', error);
      toast.error('Failed to prepare story for printing');
    }
  };


  const handleDelete = async (storyId: string, storyTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${storyTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId);

      if (error) throw error;
      
      toast.success('Story deleted successfully!');
      // Invalidate and refetch stories
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    } catch (error) {
      console.error('Error deleting story:', error);
      toast.error('Failed to delete story');
    }
  };

  const handleDownloadPDF = async (storyId: string) => {
    try {
      toast.info('Generating PDF...');
      const { data, error } = await supabase.functions.invoke('generate-story-pdf', {
        body: { storyId }
      });

      if (error) throw error;
      
      if (data?.pdfUrl) {
        const link = document.createElement('a');
        link.href = data.pdfUrl;
        link.download = data.filename || 'story.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('PDF downloaded successfully!');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleShare = (storyId: string, storyTitle: string) => {
    const shareUrl = `${window.location.origin}/review?storyId=${storyId}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success(`Share link for "${storyTitle}" copied to clipboard!`);
  };

  const handleLike = async (storyId: string) => {
    try {
      const storyToUpdate = stories.find(s => s.id === storyId);
      if (!storyToUpdate) return;

      const newLikes = (storyToUpdate.likes ?? 0) + 1;
      
      // Optimistic update
      queryClient.setQueryData(['stories'], (oldData: Story[] | undefined) => 
        oldData?.map(story => 
          story.id === storyId 
            ? { ...story, likes: newLikes }
            : story
        ) || []
      );

      const { error } = await supabase
        .from('stories')
        .update({ likes: newLikes })
        .eq('id', storyId);

      if (error) {
        // Revert optimistic update on error
        queryClient.setQueryData(['stories'], (oldData: Story[] | undefined) => 
          oldData?.map(story => 
            story.id === storyId 
              ? { ...story, likes: storyToUpdate.likes }
              : story
          ) || []
        );
        throw error;
      }

      toast.success("Story liked!");
    } catch (err) {
      const message = (err as any)?.message || (typeof err === 'string' ? err : JSON.stringify(err));
      console.error('Error liking story:', err);
      toast.error(`Failed to like story: ${message}`);
    }
  };

  const handleTogglePublic = async (storyId: string, isPublic: boolean) => {
    try {
      const storyToUpdate = stories.find(s => s.id === storyId);
      if (!storyToUpdate) return;

      // Optimistic update
      queryClient.setQueryData(['stories'], (oldData: Story[] | undefined) => 
        oldData?.map(story => 
          story.id === storyId 
            ? { ...story, is_public: isPublic }
            : story
        ) || []
      );

      const { error } = await supabase
        .from('stories')
        .update({ is_public: isPublic })
        .eq('id', storyId);

      if (error) {
        // Revert optimistic update on error
        queryClient.setQueryData(['stories'], (oldData: Story[] | undefined) => 
          oldData?.map(story => 
            story.id === storyId 
              ? { ...story, is_public: storyToUpdate.is_public }
              : story
          ) || []
        );
        throw error;
      }

      toast.success(isPublic ? "Story made public!" : "Story made private!");
    } catch (err) {
      const message = (err as any)?.message || (typeof err === 'string' ? err : JSON.stringify(err));
      console.error('Error updating story privacy:', err);
      toast.error(`Failed to update story privacy: ${message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">✓ Complete</Badge>;
      case 'generating':
        return <Badge variant="secondary">🔄 Generating</Badge>;
      case 'failed':
        return <Badge variant="destructive">⚠️ Failed</Badge>;
      default:
        return <Badge variant="outline">📝 Draft</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Loader2 className="h-10 w-10 animate-spin text-primary-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2 text-gradient">Loading your stories...</h3>
          <p className="text-muted-foreground">Getting everything ready for you</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => navigate('/')} className="p-2 hover:bg-primary/10">
                <div className="flex items-center space-x-3">
                  <div className="p-1 rounded-lg bg-gradient-primary">
                    <BookOpen className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="text-xl font-bold text-gradient">StoryBookAI</span>
                </div>
              </Button>
              <div className="hidden sm:block h-6 w-px bg-border/50"></div>
              <h1 className="text-2xl font-bold text-gradient">My Library</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate('/characters')} className="shadow-card hover:shadow-glow/20 transition-all">
                <Users className="mr-2 h-4 w-4" />
                Characters
              </Button>
              <Button onClick={() => navigate('/create')} className="shadow-glow hover:shadow-glow/80 transition-all">
                <Plus className="mr-2 h-4 w-4" />
                Create New Story
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12">
        {/* Search and Filters */}
        <section className="mb-12">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gradient">Your Story Collection</h2>
              <p className="text-muted-foreground text-lg">Manage and organize your magical stories</p>
            </div>
            
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search stories, characters, or themes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 text-lg bg-gradient-card border-0 shadow-card focus:shadow-glow/20 transition-all"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedFilter === "all" ? "default" : "outline"}
                  onClick={() => setSelectedFilter("all")}
                  className="shadow-card hover:shadow-glow/20 transition-all"
                >
                  All ({stories.length})
                </Button>
                <Button
                  variant={selectedFilter === "completed" ? "default" : "outline"}
                  onClick={() => setSelectedFilter("completed")}
                  className="shadow-card hover:shadow-glow/20 transition-all"
                >
                  Completed ({statusCounts.completed})
                </Button>
                <Button
                  variant={selectedFilter === "generating" ? "default" : "outline"}
                  onClick={() => setSelectedFilter("generating")}
                  className="shadow-card hover:shadow-glow/20 transition-all"
                >
                  Generating ({statusCounts.generating})
                </Button>
                <Button
                  variant={selectedFilter === "draft" ? "default" : "outline"}
                  onClick={() => setSelectedFilter("draft")}
                  className="shadow-card hover:shadow-glow/20 transition-all"
                >
                  Drafts ({statusCounts.draft})
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Story Grid */}
        <section className="mb-16">
          {/* Image regeneration notice */}
          {stories.length > 0 && (
            <div className="mb-8 max-w-4xl mx-auto">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <RefreshCw className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
                      Story Images Need Regeneration
                    </h3>
                    <p className="text-amber-700 dark:text-amber-300 mb-4">
                      We've optimized your story storage for better performance. Your story images need to be regenerated with our improved system.
                    </p>
                    <Button 
                      onClick={async () => {
                        if (!confirm('This will regenerate images for all your stories. This process may take several minutes. Continue?')) {
                          return;
                        }
                        
                        toast.info('Starting image regeneration for all stories...');
                        
                        for (const story of stories.slice(0, 5)) { // Limit to first 5 for now
                          try {
                            await supabase.functions.invoke('regenerate-story-images', {
                              body: { storyId: story.id }
                            });
                            toast.success(`Started regenerating images for "${story.title}"`);
                          } catch (error) {
                            console.error(`Failed to start regeneration for ${story.title}:`, error);
                            toast.error(`Failed to start regeneration for "${story.title}"`);
                          }
                        }
                        
                        toast.success('Image regeneration started for your stories!');
                        // Refresh the page after a delay
                        setTimeout(() => {
                          window.location.reload();
                        }, 2000);
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate All Images
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {filteredStories.length === 0 ? (
            <div className="max-w-2xl mx-auto">
              <Card className="p-16 text-center bg-gradient-card border-0 shadow-card">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <BookOpen className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gradient">
                  {searchQuery || selectedFilter !== "all" ? "No stories found" : "No stories yet"}
                </h3>
                <p className="text-muted-foreground text-lg mb-8">
                  {searchQuery || selectedFilter !== "all"
                    ? "Try adjusting your search terms or filters"
                    : "Create your first magical bedtime story!"
                  }
                </p>
                <Button onClick={() => navigate('/create')} size="lg" className="shadow-glow hover:shadow-glow/80 transition-all">
                  <Plus className="mr-2 h-5 w-5" />
                  Create Your First Story
                </Button>
              </Card>
            </div>
          ) : (
            <>
              {/* Story Count and Pagination Info */}
              <div className="flex justify-between items-center mb-6">
                <p className="text-muted-foreground">
                  Showing {paginatedStories.length} of {filteredStories.length} stories
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Story Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {paginatedStories.map((story) => (
                  <StoryCard key={story.id} story={story} onLike={handleLike} onTogglePublic={handleTogglePublic} onDelete={handleDelete} />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-8">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Previous
                    </Button>
                    
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let page;
                      if (totalPages <= 5) {
                        page = i + 1;
                      } else if (currentPage <= 3) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i;
                      } else {
                        page = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                    
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Stats */}
        {filteredStories.length > 0 && (
          <section className="max-w-4xl mx-auto">
            <Card className="p-8 bg-gradient-primary border-0 shadow-glow text-center text-primary-foreground">
              <h3 className="text-2xl font-bold mb-6">Your Story Statistics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <div className="text-4xl font-bold">{stories.length}</div>
                  <div className="text-lg opacity-90">Total Stories</div>
                </div>
                <div className="space-y-2">
                  <div className="text-4xl font-bold">{statusCounts.completed}</div>
                  <div className="text-lg opacity-90">Completed</div>
                </div>
                <div className="space-y-2">
                  <div className="text-4xl font-bold">{totalCharacters}</div>
                  <div className="text-lg opacity-90">Characters</div>
                </div>
              </div>
            </Card>
          </section>
        )}
      </div>

      {/* Hidden print content */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} className="print-content">
          {storyContent && (
            <div className="max-w-4xl mx-auto p-8 bg-white text-black">
              {/* Story Header */}
              <div className="text-center mb-12 border-b-2 border-gray-300 pb-8">
                <h1 className="text-4xl font-bold mb-4 text-gray-800">{storyContent.title}</h1>
                <p className="text-xl text-gray-600 mb-2">
                  A Story for {storyContent.child_name}
                  {storyContent.child_age && `, Age ${storyContent.child_age}`}
                </p>
                <div className="flex justify-center gap-2 mt-4">
                  {storyContent.themes?.map((theme: string) => (
                    <span key={theme} className="px-3 py-1 bg-gray-200 rounded-full text-sm">
                      {theme}
                    </span>
                  ))}
                </div>
              </div>

              {/* Story Pages */}
              {storyContent.pages?.map((page: any, index: number) => (
                <div key={index} className="mb-12 print:break-inside-avoid">
                  <div className="mb-6">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-800">
                      Page {index + 1}
                    </h2>
                    {page.illustration_url && (
                      <div className="text-center mb-6">
                        <img 
                          src={page.illustration_url} 
                          alt={`Illustration for page ${index + 1}`}
                          className="max-w-full h-auto max-h-96 mx-auto rounded-lg shadow-sm"
                          onError={(e) => {
                            // Hide broken images gracefully
                            e.currentTarget.style.display = 'none';
                          }}
                          onLoad={(e) => {
                            // Ensure image is visible when loaded successfully
                            e.currentTarget.style.display = 'block';
                          }}
                        />
                      </div>
                    )}
                    <div className="prose prose-lg max-w-none">
                      <p className="text-lg leading-relaxed text-gray-700 whitespace-pre-wrap">
                        {page.content}
                      </p>
                    </div>
                  </div>
                  {index < storyContent.pages.length - 1 && (
                    <div className="print:break-after-page border-t border-gray-300 mt-8"></div>
                  )}
                </div>
              ))}

              {/* Story Footer */}
              <div className="text-center mt-12 pt-8 border-t-2 border-gray-300">
                <p className="text-sm text-gray-500">
                  Created with StoryBookAI • {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Library;