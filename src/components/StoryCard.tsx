import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Star, Globe, Lock, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LazyImage } from "./LazyImage";
import { useStoryImageQuery } from "@/hooks/useStoriesQuery";
import { useIntersectionObserver } from "./IntersectionObserver";

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
  likes: number;
  first_page_image?: string;
  is_public?: boolean;
}

interface StoryCardProps {
  story: Story;
  onLike: (storyId: string) => void;
  onTogglePublic?: (storyId: string, isPublic: boolean) => void;
  onDelete?: (storyId: string, storyTitle: string) => void;
  isPublicView?: boolean;
}

export const StoryCard = ({ story, onLike, onTogglePublic, onDelete, isPublicView = false }: StoryCardProps) => {
  const navigate = useNavigate();
  const { ref, hasIntersected } = useIntersectionObserver({ rootMargin: '100px' });
  
  // Use lazy loading for images with intersection observer for better performance
  const { data: lazyImage, isLoading: imageLoading } = useStoryImageQuery(
    story.id, 
    hasIntersected && !story.first_page_image // Only fetch when visible and if we don't already have the image
  );

  const imageUrl = story.first_page_image || lazyImage;

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

  return (
    <div ref={ref} className="group relative">
      {/* Book Cover */}
      <div 
        className="relative bg-gradient-to-br from-primary/10 via-background to-accent/10 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1 hover:rotate-1 cursor-pointer border border-border/20 perspective-1000"
        onClick={() => navigate(`/review?storyId=${story.id}&from=public-stories`)}
        style={{
          transformStyle: 'preserve-3d',
          boxShadow: '0 8px 25px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1) inset'
        }}
      >
        
        {/* Book Spine Effect */}
        <div className="absolute left-0 top-0 w-1.5 h-full bg-gradient-to-b from-primary/70 to-primary/50 shadow-inner"></div>
        
        {/* Cover Image */}
        <div className="aspect-[2/3] relative overflow-hidden">
          {hasIntersected ? (
            <LazyImage 
              src={imageUrl}
              alt={`${story.title} cover`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              fallback={
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/15 to-primary/10 flex flex-col items-center justify-center p-4 text-center">
                  <BookOpen className="h-8 w-8 text-primary/60 mb-3" />
                  <h3 className="font-bold text-sm leading-tight text-primary/80 line-clamp-2">{story.title}</h3>
                </div>
              }
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/15 to-primary/10 flex flex-col items-center justify-center p-4 text-center">
              <BookOpen className="h-8 w-8 text-primary/60 mb-3" />
              <h3 className="font-bold text-sm leading-tight text-primary/80 line-clamp-2">{story.title}</h3>
            </div>
          )}
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          {/* Status Badge - Only show for private library view */}
          {!isPublicView && (
            <div className="absolute top-2 right-2 z-10">
              {getStatusBadge(story.status)}
            </div>
          )}
          
          {/* Like Button - Show only if not in public view or make it read-only */}
          {!isPublicView ? (
            <Button 
              size="sm" 
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onLike(story.id);
              }}
              className="absolute top-2 left-2 z-10 text-white hover:text-yellow-400 hover:bg-black/20 backdrop-blur-sm bg-black/10 border border-white/20 h-7 w-7 p-0"
            >
              <Star className="h-3 w-3 fill-current" />
              <span className="ml-1 text-xs hidden group-hover:inline">{story.likes || 0}</span>
            </Button>
          ) : (
            <div className="absolute top-2 left-2 z-10 text-white backdrop-blur-sm bg-black/10 border border-white/20 h-7 px-2 rounded flex items-center text-xs">
              <Star className="h-3 w-3 fill-current mr-1" />
              {story.likes || 0}
            </div>
          )}

          {/* Public/Private Toggle - Only show for authenticated users */}
          {onTogglePublic && !isPublicView && (
            <Button 
              size="sm" 
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePublic(story.id, !story.is_public);
              }}
              className="absolute bottom-2 left-2 z-10 text-white hover:bg-black/20 backdrop-blur-sm bg-black/10 border border-white/20 h-7 w-7 p-0"
            >
              {story.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            </Button>
          )}

          {/* Delete Button - Only show for authenticated users */}
          {onDelete && !isPublicView && (
            <Button 
              size="sm" 
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(story.id, story.title);
              }}
              className="absolute bottom-2 right-2 z-10 text-white hover:text-red-400 hover:bg-black/20 backdrop-blur-sm bg-black/10 border border-white/20 h-7 w-7 p-0"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {/* Book Title on Spine */}
        <div className="absolute bottom-4 left-2 right-4">
          <h3 className="font-bold text-xs text-primary/90 line-clamp-2 leading-tight drop-shadow-sm">
            {story.title}
          </h3>
          <p className="text-xs text-primary/70 mt-1 font-medium">
            {story.child_name}
          </p>
        </div>
        
        {/* Book Pages Effect */}
        <div className="absolute right-0 top-1 bottom-1 w-2 bg-gradient-to-r from-background/20 to-background/40 opacity-60"></div>
        <div className="absolute right-1 top-2 bottom-2 w-1 bg-gradient-to-r from-background/30 to-background/60 opacity-40"></div>
      </div>
    </div>
  );
};