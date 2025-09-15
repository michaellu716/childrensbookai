import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { BookOpen, Search, Users, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { usePublicStoriesQuery, type PublicStory } from "@/hooks/usePublicStoriesQuery";
import { StoryCard } from "@/components/StoryCard";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Footer } from "@/components/Footer";

const STORIES_PER_PAGE = 24;

const PublicStories = () => {
  const navigate = useNavigate();
  const { data: stories = [], isLoading, error } = usePublicStoriesQuery();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [user, setUser] = useState<User | null>(null);

  // Check authentication status
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Memoize filtered stories and statistics (without accessing child personal info)
  const { filteredStories, totalStories } = useMemo(() => {
    const lowerSearchQuery = searchQuery.toLowerCase();
    
    const filtered = stories.filter(story => {
      // Apply search filter (only on safe, non-personal fields)
      const matchesSearch = !searchQuery || 
        story.title.toLowerCase().includes(lowerSearchQuery) ||
        story.themes?.some(theme => theme.toLowerCase().includes(lowerSearchQuery));

      // Apply status filter (for public stories, we only show completed ones)
      const matchesFilter = selectedFilter === 'all' || story.art_style === selectedFilter;

      return matchesSearch && matchesFilter;
    });

    return {
      filteredStories: filtered,
      totalStories: stories.length
    };
  }, [stories, searchQuery, selectedFilter]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredStories.length / STORIES_PER_PAGE);
  const paginatedStories = useMemo(() => {
    const startIndex = (currentPage - 1) * STORIES_PER_PAGE;
    return filteredStories.slice(startIndex, startIndex + STORIES_PER_PAGE);
  }, [filteredStories, currentPage]);

  // Reset to first page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilter]);

  // Get unique art styles for filter
  const artStyles = useMemo(() => {
    const styles = new Set(stories.map(story => story.art_style).filter(Boolean));
    return Array.from(styles).sort();
  }, [stories]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading public stories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Error loading stories</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/landing')} size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold bg-gradient-hero bg-clip-text text-transparent">
                  Public Story Gallery
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Button variant="outline" onClick={() => navigate('/library')}>
                    My Library
                  </Button>
                  <Button onClick={() => navigate('/create')} className="shadow-glow hover:shadow-glow/80 transition-all">
                    Create Story
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => navigate('/auth?redirect=/public-stories')}>
                    Sign In
                  </Button>
                  <Button onClick={() => navigate('/auth?redirect=/public-stories')} className="shadow-glow hover:shadow-glow/80 transition-all">
                    Create Story
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Discover Amazing Stories</h2>
              <p className="text-muted-foreground">
                Explore creative stories shared by our community
              </p>
            </div>
            
            {/* Statistics */}
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="font-medium">{filteredStories.length}</span>
                <span>Stories Found</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-accent rounded-full"></div>
                <span className="font-medium">{totalStories}</span>
                <span>Total Public Stories</span>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by title or themes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("all")}
              >
                All Styles
              </Button>
              {artStyles.map((style) => (
                <Button
                  key={style}
                  variant={selectedFilter === style ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFilter(style)}
                  className="capitalize"
                >
                  {style}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Stories Content */}
        {paginatedStories.length === 0 ? (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <BookOpen className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery || selectedFilter !== "all" 
                  ? "No stories match your search" 
                  : "No public stories yet"
                }
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery || selectedFilter !== "all"
                  ? "Try adjusting your search terms or filters"
                  : "Be the first to share a story with the community!"
                }
              </p>
              <Button onClick={() => user ? navigate('/create') : navigate('/auth?redirect=/public-stories')} className="shadow-glow hover:shadow-glow/80 transition-all">
                {user ? 'Create Your Story' : 'Sign In to Create Stories'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Story Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {paginatedStories.map((story) => (
                <StoryCard 
                  key={story.id} 
                  story={story as any} 
                  onLike={() => {}} 
                  isPublicView={true}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-8">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else {
                        const start = Math.max(1, currentPage - 2);
                        const end = Math.min(totalPages, start + 4);
                        pageNum = start + i;
                        if (pageNum > end) return null;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};


export default PublicStories;