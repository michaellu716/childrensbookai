import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2, User } from "lucide-react";
import { LazyImage } from "./LazyImage";

interface Character {
  id: string;
  name: string;
  hair_color: string;
  hair_style: string;
  eye_color: string;
  skin_tone: string;
  typical_outfit: string;
  accessory: string;
  cartoon_reference_url: string;
  photo_url: string;
  likes: number;
  created_at: string;
  user_id: string;
}

interface CharacterCardProps {
  character: Character;
  onLike: (characterId: string) => void;
  onDelete: (characterId: string, characterName: string) => void;
  onClick: (character: Character) => void;
}

export const CharacterCard = ({ character, onLike, onDelete, onClick }: CharacterCardProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card className="group relative overflow-hidden bg-gradient-card border-0 shadow-card hover:shadow-glow/20 transition-all duration-300 cursor-pointer">
      <div onClick={() => onClick(character)}>
        {/* Character Image */}
        <div className="aspect-square relative overflow-hidden">
          <LazyImage
            src={character.cartoon_reference_url || character.photo_url}
            alt={`${character.name} character`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            fallback={
              <div className="w-full h-full bg-gradient-to-br from-primary/20 via-accent/15 to-primary/10 flex items-center justify-center">
                <User className="h-12 w-12 text-primary/60" />
              </div>
            }
          />
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          {/* Like Button */}
          <Button 
            size="sm" 
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onLike(character.id);
            }}
            className="absolute top-2 right-2 z-10 text-white hover:text-yellow-400 hover:bg-black/20 backdrop-blur-sm bg-black/10 border border-white/20 h-8 w-8 p-0"
          >
            <Star className="h-4 w-4 fill-current" />
            <span className="ml-1 text-xs hidden group-hover:inline">{character.likes || 0}</span>
          </Button>

          {/* Delete Button */}
          <Button 
            size="sm" 
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(character.id, character.name);
            }}
            className="absolute top-2 left-2 z-10 text-white hover:text-red-400 hover:bg-black/20 backdrop-blur-sm bg-black/10 border border-white/20 h-8 w-8 p-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Character Info */}
        <div className="p-6">
          <h3 className="font-bold text-lg mb-2 text-gradient line-clamp-1">{character.name}</h3>
          
          {/* Character Features */}
          <div className="space-y-2 mb-4">
            <div className="flex flex-wrap gap-2">
              {character.hair_color && (
                <Badge variant="outline" className="text-xs">
                  {character.hair_color} hair
                </Badge>
              )}
              {character.eye_color && (
                <Badge variant="outline" className="text-xs">
                  {character.eye_color} eyes
                </Badge>
              )}
            </div>
            
            {character.typical_outfit && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {character.typical_outfit}
              </p>
            )}
          </div>

          {/* Created Date */}
          <p className="text-xs text-muted-foreground">
            Created {formatDate(character.created_at)}
          </p>
        </div>
      </div>
    </Card>
  );
};