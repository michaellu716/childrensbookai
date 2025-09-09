import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LazyImage } from "./LazyImage";
import { useStoryImageQuery } from "@/hooks/useStoriesQuery";

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
}

interface StoryCardProps {
  story: Story;
  onLike: (storyId: string) => void;
}

export const StoryCard = ({ story, onLike }: StoryCardProps) => {
  const navigate = useNavigate();
  
  // Use lazy loading for images if not already loaded
  const { data: lazyImage } = useStoryImageQuery(
    story.id, 
    !story.first_page_image // Only fetch if we don't already have the image
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
    <div className="group relative">
      {/* Book Cover */}
      <div 
        className="relative bg-gradient-to-br from-primary/10 via-background to-accent/10 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1 hover:rotate-1 cursor-pointer border border-border/20 perspective-1000"
        onClick={() => navigate(`/review?storyId=${story.id}`)}
        style={{
          transformStyle: 'preserve-3d',
          boxShadow: '0 8px 25px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1) inset'
        }}
      >
        
        {/* Book Spine Effect */}
        <div className="absolute left-0 top-0 w-1.5 h-full bg-gradient-to-b from-primary/70 to-primary/50 shadow-inner"></div>
        
        {/* Cover Image */}
        <div className="aspect-[2/3] relative overflow-hidden">
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
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          {/* Status Badge */}
          <div className="absolute top-2 right-2 z-10">
            {getStatusBadge(story.status)}
          </div>
          
          {/* Like Button */}
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