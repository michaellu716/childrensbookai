import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { BookOpen, Search, Heart, Users, ArrowLeft, Sparkles, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import catImage from "@/assets/characters/cat-1.jpg";
import dogImage from "@/assets/characters/dog-1.jpg";
import rabbitImage from "@/assets/characters/rabbit-1.jpg";
import bearImage from "@/assets/characters/bear-1.jpg";
import elephantImage from "@/assets/characters/elephant-1.jpg";
import lionImage from "@/assets/characters/lion-1.jpg";
import foxImage from "@/assets/characters/fox-1.jpg";
import pandaImage from "@/assets/characters/panda-1.jpg";

interface Character {
  id: string;
  name: string;
  hair_color?: string;
  hair_style?: string;
  eye_color?: string;
  skin_tone?: string;
  typical_outfit?: string;
  accessory?: string;
  cartoon_reference_url?: string;
  likes: number;
  created_at: string;
  user_id: string;
  story_count?: number;
}

const Characters = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [likedCharacters, setLikedCharacters] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCharacters, setTotalCharacters] = useState(0);
  const charactersPerPage = 24;

  useEffect(() => {
    fetchCharacters(currentPage, searchQuery);
  }, [currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    fetchCharacters(1, searchQuery);
  }, [searchQuery]);

  const fetchCharacters = async (page = 1, searchTerm = "") => {
    try {
      let charactersData, totalCount;

      if (searchTerm) {
        // For search, fetch all characters and filter client-side
        const { data, error, count } = await supabase
          .from('character_sheets')
          .select(`
            id, 
            name, 
            hair_color, 
            hair_style, 
            eye_color, 
            skin_tone, 
            typical_outfit, 
            accessory, 
            cartoon_reference_url, 
            likes, 
            created_at, 
            user_id
          `, { count: 'exact' })
          .order('created_at', { ascending: false });

        if (error) throw error;
        charactersData = data;
        totalCount = count;
      } else {
        // For normal browsing, use pagination
        const { count } = await supabase
          .from('character_sheets')
          .select('*', { count: 'exact', head: true });
        
        setTotalCharacters(count || 0);

        const from = (page - 1) * charactersPerPage;
        const to = from + charactersPerPage - 1;

        const { data, error } = await supabase
          .from('character_sheets')
          .select(`
            id, 
            name, 
            hair_color, 
            hair_style, 
            eye_color, 
            skin_tone, 
            typical_outfit, 
            accessory, 
            cartoon_reference_url, 
            likes, 
            created_at, 
            user_id
          `)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;
        charactersData = data;
        totalCount = count;
      }

      // Get story count for each character
      const charactersWithStoryCount = await Promise.all(
        (charactersData || []).map(async (character) => {
          try {
            const { count } = await supabase
              .from('stories')
              .select('id', { count: 'exact', head: true })
              .eq('character_sheet_id', character.id);
            
            return {
              ...character,
              story_count: count || 0
            };
          } catch {
            return { ...character, story_count: 0 };
          }
        })
      );

      setCharacters(charactersWithStoryCount);
      if (searchTerm) {
        setTotalCharacters(totalCount || 0);
      }
    } catch (error) {
      console.error('Error fetching characters:', error);
      toast.error('Failed to load characters');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCharacters = useMemo(() => {
    if (!searchQuery) return characters;
    
    const lowerSearchQuery = searchQuery.toLowerCase();
    return characters.filter(character => 
      character.name?.toLowerCase().includes(lowerSearchQuery) ||
      character.hair_color?.toLowerCase().includes(lowerSearchQuery) ||
      character.eye_color?.toLowerCase().includes(lowerSearchQuery) ||
      character.typical_outfit?.toLowerCase().includes(lowerSearchQuery)
    );
  }, [characters, searchQuery]);

  const handleLike = async (characterId: string) => {
    try {
      const character = characters.find(c => c.id === characterId);
      if (!character) return;

      const newLikes = character.likes + 1;
      
      const { error } = await supabase
        .from('character_sheets')
        .update({ likes: newLikes })
        .eq('id', characterId);

      if (error) throw error;

      setCharacters(characters.map(char => 
        char.id === characterId 
          ? { ...char, likes: newLikes }
          : char
      ));

      // Add to liked characters for animation
      setLikedCharacters(prev => new Set(prev).add(characterId));
      setTimeout(() => {
        setLikedCharacters(prev => {
          const newSet = new Set(prev);
          newSet.delete(characterId);
          return newSet;
        });
      }, 1000);

      toast.success("Character liked! 💖");
    } catch (error) {
      console.error("Error liking character:", error);
      toast.error("Failed to like character");
    }
  };

  const getCharacterTraits = (character: Character) => {
    const traits = [];
    if (character.hair_color) traits.push(`${character.hair_color} hair`);
    if (character.eye_color) traits.push(`${character.eye_color} eyes`);
    if (character.skin_tone) traits.push(character.skin_tone);
    return traits;
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
          <h3 className="text-xl font-semibold mb-2 text-gradient">Loading characters...</h3>
          <p className="text-muted-foreground">Finding all your amazing characters</p>
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
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
              <div className="hidden sm:block h-6 w-px bg-border/50"></div>
              <div className="flex items-center space-x-3">
                <div className="p-1 rounded-lg bg-gradient-primary">
                  <Users className="h-5 w-5 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-bold text-gradient">Character Gallery</h1>
              </div>
            </div>
            <Button onClick={() => navigate('/create')} className="shadow-glow hover:shadow-glow/80 transition-all">
              <Sparkles className="mr-2 h-4 w-4" />
              Create New Story
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12">
        {/* Hero Section */}
        <section className="mb-12">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold mb-4 text-gradient">Meet Your Amazing Characters! 🌟</h2>
              <p className="text-muted-foreground text-lg">
                Discover all the wonderful cartoon characters from your stories. Give them some love with likes!
              </p>
            </div>
            
            {/* Search Bar */}
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search characters by name, traits, or outfit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-lg bg-gradient-card border-0 shadow-card focus:shadow-glow/20 transition-all rounded-full"
              />
            </div>

            {/* Stats */}
            <div className="flex justify-center gap-6 text-center">
              <div className="bg-gradient-card rounded-lg p-4 shadow-card">
                <div className="text-2xl font-bold text-primary">{totalCharacters}</div>
                <div className="text-sm text-muted-foreground">Total Characters</div>
              </div>
              <div className="bg-gradient-card rounded-lg p-4 shadow-card">
                <div className="text-2xl font-bold text-pink-500">
                  {characters.reduce((sum, char) => sum + char.likes, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Page Likes</div>
              </div>
              <div className="bg-gradient-card rounded-lg p-4 shadow-card">
                <div className="text-2xl font-bold text-accent">
                  {characters.reduce((sum, char) => sum + (char.story_count || 0), 0)}
                </div>
                <div className="text-sm text-muted-foreground">Page Stories</div>
              </div>
            </div>
          </div>
        </section>

        {/* Characters Gallery */}
        <section>
          {filteredCharacters.length === 0 ? (
            <div className="max-w-2xl mx-auto">
              <Card className="p-16 text-center bg-gradient-card border-0 shadow-card">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gradient">
                  {searchQuery ? "No characters found" : "No characters yet"}
                </h3>
                <p className="text-muted-foreground text-lg mb-8">
                  {searchQuery
                    ? "Try searching with different terms"
                    : "Create your first story with a character to see them here!"
                  }
                </p>
                <Button onClick={() => navigate('/create')} size="lg" className="shadow-glow hover:shadow-glow/80 transition-all">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Create Your First Character
                </Button>
              </Card>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-4">
                {filteredCharacters.map((character) => (
                  <Card 
                    key={character.id} 
                    className="group overflow-hidden bg-gradient-card border-0 shadow-card hover:shadow-glow/30 transition-all duration-500 transform hover:-translate-y-1"
                  >
                    {/* Character Image */}
                    <div className="aspect-[3/4] relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5">
                      {character.cartoon_reference_url ? (
                        <img
                          src={character.cartoon_reference_url}
                          alt={character.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      
                      {/* Fallback Character Display */}
                      <div className={`absolute inset-0 flex flex-col items-center justify-center p-2 text-center ${character.cartoon_reference_url ? 'hidden' : ''}`}>
                        <div className="text-2xl mb-1">🎭</div>
                        <h3 className="font-bold text-xs text-primary/80 line-clamp-2">{character.name}</h3>
                      </div>
                      
                      {/* Like Button */}
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleLike(character.id)}
                        className={`absolute top-1 right-1 z-10 text-white hover:text-pink-400 hover:bg-black/20 backdrop-blur-sm bg-black/10 border border-white/20 transition-all h-5 w-5 p-0 ${
                          likedCharacters.has(character.id) ? 'animate-bounce scale-110' : ''
                        }`}
                      >
                        <Heart className={`h-2 w-2 ${character.likes > 0 ? 'fill-pink-400 text-pink-400' : ''}`} />
                      </Button>

                      {/* Story Count Badge */}
                      {(character.story_count || 0) > 0 && (
                        <Badge className="absolute top-1 left-1 bg-primary/80 text-primary-foreground text-xs px-1 py-0">
                          {character.story_count}
                        </Badge>
                      )}
                    </div>

                    {/* Character Info */}
                    <div className="p-2">
                      <div className="mb-2">
                        <h3 className="text-xs font-bold mb-1 text-foreground line-clamp-1">{character.name}</h3>
                        
                        {getCharacterTraits(character).length > 0 && (
                          <div className="mb-1">
                            <Badge 
                              variant="secondary" 
                              className="text-xs bg-primary/10 text-primary border-primary/20 px-1 py-0"
                            >
                              {getCharacterTraits(character)[0].length > 6 ? getCharacterTraits(character)[0].substring(0, 6) + '..' : getCharacterTraits(character)[0]}
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Heart className="h-2 w-2 fill-pink-400 text-pink-400" />
                          <span className="text-xs">{character.likes}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {!searchQuery && totalCharacters > charactersPerPage && (
                <div className="flex justify-center mt-8">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.ceil(totalCharacters / charactersPerPage) }, (_, i) => i + 1)
                        .filter(page => {
                          const distance = Math.abs(page - currentPage);
                          return distance <= 2 || page === 1 || page === Math.ceil(totalCharacters / charactersPerPage);
                        })
                        .map((page, index, visiblePages) => {
                          const prevPage = visiblePages[index - 1];
                          const showEllipsis = prevPage && page - prevPage > 1;
                          
                          return (
                            <div key={page} className="flex items-center">
                              {showEllipsis && (
                                <PaginationItem>
                                  <span className="px-3 py-2 text-muted-foreground">...</span>
                                </PaginationItem>
                              )}
                              <PaginationItem>
                                <PaginationLink
                                  onClick={() => setCurrentPage(page)}
                                  isActive={currentPage === page}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            </div>
                          );
                        })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(Math.min(Math.ceil(totalCharacters / charactersPerPage), currentPage + 1))}
                          className={currentPage >= Math.ceil(totalCharacters / charactersPerPage) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Characters;