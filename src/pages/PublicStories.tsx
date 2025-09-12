import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Search, BookOpen, Users, Star, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { usePublicStoriesQuery, type PublicStory } from "@/hooks/usePublicStoriesQuery";
import { LazyImage } from "@/components/LazyImage";
import { useState, useMemo } from "react";

const STORIES_PER_PAGE = 12;

const PublicStories = () => {
  const navigate = useNavigate();
  const { data: stories = [], isLoading, error } = usePublicStoriesQuery();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter stories based on search query
  const filteredStories = useMemo(() => {
    if (!searchQuery.trim()) return stories;
    
    const query = searchQuery.toLowerCase();
    return stories.filter(story => 
      story.title.toLowerCase().includes(query) ||
      story.child_name?.toLowerCase().includes(query) ||
      story.themes?.some(theme => theme.toLowerCase().includes(query))
    );
  }, [stories, searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredStories.length / STORIES_PER_PAGE);
  const paginatedStories = useMemo(() => {
    const startIndex = (currentPage - 1) * STORIES_PER_PAGE;
    return filteredStories.slice(startIndex, startIndex + STORIES_PER_PAGE);
  }, [filteredStories, currentPage]);

  // Reset to first page when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/landing')} size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Public Story Gallery</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate('/auth')}>
                Sign In
              </Button>
              <Button onClick={() => navigate('/create')}>
                Create Story
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter Section */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search stories by title, child name, or themes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Statistics */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              <span>{filteredStories.length} stories</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{new Set(stories.map(s => s.child_name)).size} characters</span>
            </div>
          </div>
        </div>

        {/* Stories Grid */}
        {paginatedStories.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No stories found</h3>
            <p className="text-muted-foreground">
              {searchQuery ? "Try adjusting your search terms" : "No public stories available yet"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {paginatedStories.map((story) => (
                <PublicStoryCard key={story.id} story={story} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <span className="text-sm text-muted-foreground px-4">
                  Page {currentPage} of {totalPages}
                </span>
                
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
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface PublicStoryCardProps {
  story: PublicStory;
}

const PublicStoryCard = ({ story }: PublicStoryCardProps) => {
  const navigate = useNavigate();

  return (
    <Card 
      className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-card bg-gradient-card border-border/50"
      onClick={() => navigate(`/review?story=${story.id}`)}
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <LazyImage
          src={story.first_page_image || "/placeholder.svg"}
          alt={`${story.title} cover`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="bg-background/80 text-foreground">
            {story.art_style}
          </Badge>
        </div>
        <div className="absolute bottom-2 left-2 right-2 text-white">
          <h3 className="font-bold text-lg mb-1 line-clamp-2">{story.title}</h3>
          <p className="text-sm opacity-90">For {story.child_name}</p>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="h-4 w-4" />
            <span>{story.likes}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {story.length} pages
          </Badge>
        </div>
        
        {story.themes && story.themes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {story.themes.slice(0, 2).map((theme, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {theme}
              </Badge>
            ))}
            {story.themes.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{story.themes.length - 2}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default PublicStories;