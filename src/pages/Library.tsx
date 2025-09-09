import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { BookOpen, Search, Plus, Download, Share, Copy, Trash2, Loader2, AlertCircle, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useReactToPrint } from 'react-to-print';

interface Story {
  id: string;
  title: string;
  child_name: string;
  child_age: string;
  themes: string[];
  art_style: string;
  length: number;
  created_at: string;
  status: string;
  updated_at: string;
  user_id: string;
}

const Library = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storyContent, setStoryContent] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('id, title, child_name, child_age, themes, art_style, length, created_at, status, updated_at, user_id')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStories(data || []);
    } catch (error) {
      console.error('Error fetching stories:', error);
      toast.error('Failed to load your stories');
    } finally {
      setIsLoading(false);
    }
  };

  // Memoize expensive computations
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
    
    return {
      filteredStories: filtered,
      statusCounts: counts,
      totalCharacters: uniqueCharacters.size
    };
  }, [stories, searchQuery, selectedFilter]);

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
        // Fetch page illustrations from story_generations table
        const { data: generationsData } = await supabase
          .from('story_generations')
          .select('page_number, generation_result')
          .eq('story_id', storyId)
          .eq('generation_type', 'illustration')
          .eq('status', 'completed');

        // Create a map of page illustrations
        const illustrationsMap = new Map();
        generationsData?.forEach((gen: any) => {
          if (gen.generation_result?.image_url) {
            illustrationsMap.set(gen.page_number, gen.generation_result.image_url);
          }
        });

        // Combine story data with pages and illustrations
        const storyWithPages = {
          ...data.story,
          pages: data.pages.map((page: any) => ({
            ...page,
            content: page.text_content,
            illustration_url: illustrationsMap.get(page.page_number) || null
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

  const handleDuplicate = async (storyId: string) => {
    try {
      const { data: originalStory } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .single();

      if (originalStory) {
        const { data: newStory, error } = await supabase
          .from('stories')
          .insert({
            title: `${originalStory.title} (Copy)`,
            prompt: originalStory.prompt,
            child_name: originalStory.child_name,
            child_age: originalStory.child_age,
            themes: originalStory.themes,
            lesson: originalStory.lesson,
            tone: originalStory.tone,
            art_style: originalStory.art_style,
            reading_level: originalStory.reading_level,
            language: originalStory.language,
            length: originalStory.length,
            status: 'draft',
            user_id: originalStory.user_id
          })
          .select()
          .single();

        if (error) throw error;
        
        toast.success('Story duplicated successfully!');
        navigate(`/create?duplicate=${newStory.id}`);
      }
    } catch (error) {
      console.error('Error duplicating story:', error);
      toast.error('Failed to duplicate story');
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
      fetchStories(); // Refresh the list
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your stories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => navigate('/')}>
                <BookOpen className="mr-2 h-4 w-4" />
                StoryBookAI
              </Button>
              <div className="hidden sm:block h-6 w-px bg-border"></div>
              <h1 className="text-xl font-semibold">My Library</h1>
            </div>
            <Button variant="hero" onClick={() => navigate('/create')}>
              <Plus className="mr-2 h-4 w-4" />
              Create New Story
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stories, characters, or themes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("all")}
              >
                All ({stories.length})
              </Button>
              <Button
                variant={selectedFilter === "completed" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("completed")}
              >
                Completed ({statusCounts.completed})
              </Button>
              <Button
                variant={selectedFilter === "generating" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("generating")}
              >
                Generating ({statusCounts.generating})
              </Button>
              <Button
                variant={selectedFilter === "draft" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("draft")}
              >
                Drafts ({statusCounts.draft})
              </Button>
            </div>
          </div>
        </div>

        {/* Stories Grid */}
        {filteredStories.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-card">
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery || selectedFilter !== "all" ? "No stories found" : "No stories yet"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery || selectedFilter !== "all"
                ? "Try adjusting your search terms or filters"
                : "Create your first magical bedtime story!"
              }
            </p>
            <Button variant="hero" onClick={() => navigate('/create')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Story
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStories.map((story) => (
              <Card key={story.id} className="overflow-hidden hover:shadow-card transition-all duration-300 bg-gradient-card group">
                {/* Header */}
                <div className="relative p-6 border-b bg-gradient-to-r from-primary/5 to-secondary/5">
                  <div className="absolute top-3 right-3">
                    {getStatusBadge(story.status)}
                  </div>
                  <div className="pr-20">
                    <h3 className="font-semibold text-lg line-clamp-2 mb-1">{story.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      For {story.child_name}, {story.child_age ? `age ${story.child_age}` : ''}
                    </p>
                    <div className="text-xs text-muted-foreground mt-2">
                      {story.length} pages • {story.art_style}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="space-y-3">
                    {/* Themes */}
                    {story.themes && story.themes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {story.themes.slice(0, 3).map((theme) => (
                          <Badge key={theme} variant="outline" className="text-xs">
                            {theme}
                          </Badge>
                        ))}
                        {story.themes.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{story.themes.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Created {formatDate(story.created_at)}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 pt-2">
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => navigate(`/review?storyId=${story.id}`)}
                        className="flex-1"
                      >
                        {story.status === "completed" ? "View" : story.status === "generating" ? "Check Progress" : "Continue"}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDuplicate(story.id)}
                        title="Duplicate story"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                       {story.status === "completed" && (
                         <>
                           <Button 
                             size="sm" 
                             variant="outline"
                             onClick={() => handleDownloadPDF(story.id)}
                             title="Download PDF"
                           >
                             <Download className="h-4 w-4" />
                           </Button>
                           <Button 
                             size="sm" 
                             variant="outline"
                             onClick={() => handlePrintStory(story.id, story.title)}
                             title="Print story"
                           >
                             <Printer className="h-4 w-4" />
                           </Button>
                           <Button 
                             size="sm" 
                             variant="outline"
                             onClick={() => handleShare(story.id, story.title)}
                             title="Share story"
                           >
                             <Share className="h-4 w-4" />
                           </Button>
                         </>
                       )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDelete(story.id, story.title)}
                        className="text-destructive hover:text-destructive"
                        title="Delete story"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Stats */}
        {filteredStories.length > 0 && (
          <Card className="mt-8 p-6 bg-gradient-accent text-center">
            <div className="grid grid-cols-3 gap-4 text-accent-foreground">
              <div>
                <div className="text-2xl font-bold">{stories.length}</div>
                <div className="text-sm opacity-90">Total Stories</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{statusCounts.completed}</div>
                <div className="text-sm opacity-90">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{totalCharacters}</div>
                <div className="text-sm opacity-90">Characters</div>
              </div>
            </div>
          </Card>
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
    </div>
  );
};

export default Library;