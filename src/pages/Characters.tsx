import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Search, Users, ArrowLeft, Sparkles, Loader2, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCharactersQuery, type Character } from "@/hooks/useCharactersQuery";
import { CharacterCard } from "@/components/CharacterCard";
import { useQueryClient } from '@tanstack/react-query';
import { Footer } from "@/components/Footer";

const CHARACTERS_PER_PAGE = 24;

const Characters = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: characters = [], isLoading, error } = useCharactersQuery();

  useEffect(() => {
    if (error) {
      console.error('Error fetching characters:', error);
      toast.error('Failed to load characters');
    }
  }, [error]);

  // Memoize filtering without side effects
  const filteredCharacters = useMemo(() => {
    const base = !searchQuery
      ? [...characters]
      : characters.filter(character => {
          const q = searchQuery.toLowerCase();
          return (
            character.name?.toLowerCase().includes(q) ||
            character.hair_color?.toLowerCase().includes(q) ||
            character.eye_color?.toLowerCase().includes(q) ||
            character.typical_outfit?.toLowerCase().includes(q)
          );
        });

    return base.sort((a, b) => {
      const likeDiff = (b.likes || 0) - (a.likes || 0);
      if (likeDiff !== 0) return likeDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [characters, searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredCharacters.length / CHARACTERS_PER_PAGE);
  
  // Reset to page 1 when filters change (in useEffect to avoid infinite renders)
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredCharacters.length, currentPage, totalPages]);

  // Calculate paginated results
  const paginatedCharacters = useMemo(() => {
    const startIndex = (currentPage - 1) * CHARACTERS_PER_PAGE;
    const endIndex = startIndex + CHARACTERS_PER_PAGE;
    return filteredCharacters.slice(startIndex, endIndex);
  }, [filteredCharacters, currentPage]);

  const handleLike = async (characterId: string) => {
    try {
      const character = characters.find(c => c.id === characterId);
      if (!character) return;

      const newLikes = (character.likes ?? 0) + 1;
      
      // Optimistic update
      queryClient.setQueryData(['characters'], (oldData: Character[] | undefined) => 
        oldData?.map(char => 
          char.id === characterId 
            ? { ...char, likes: newLikes }
            : char
        ) || []
      );

      const { error } = await supabase
        .from('character_sheets')
        .update({ likes: newLikes })
        .eq('id', characterId);

      if (error) {
        // Revert optimistic update on error
        queryClient.setQueryData(['characters'], (oldData: Character[] | undefined) => 
          oldData?.map(char => 
            char.id === characterId 
              ? { ...char, likes: character.likes }
              : char
          ) || []
        );
        throw error;
      }

      toast.success("Character liked! 💖");
    } catch (err) {
      const message = (err as any)?.message || (typeof err === 'string' ? err : JSON.stringify(err));
      console.error('Error liking character:', err);
      toast.error(`Failed to like character: ${message}`);
    }
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
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate('/library')} className="shadow-card hover:shadow-glow/20 transition-all">
                <BookOpen className="mr-2 h-4 w-4" />
                My Library
              </Button>
              <Button onClick={() => navigate('/create')} className="shadow-glow hover:shadow-glow/80 transition-all">
                <Sparkles className="mr-2 h-4 w-4" />
                Create New Story
              </Button>
            </div>
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
                <div className="text-2xl font-bold text-primary">{filteredCharacters.length}</div>
                <div className="text-sm text-muted-foreground">Total Characters</div>
              </div>
              <div className="bg-gradient-card rounded-lg p-4 shadow-card">
                <div className="text-2xl font-bold text-pink-500">
                  {characters.reduce((sum, char) => sum + (char.likes || 0), 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Likes</div>
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
            <>
              {/* Character Count and Pagination Info */}
              <div className="flex justify-between items-center mb-6">
                <p className="text-muted-foreground">
                  Showing {paginatedCharacters.length} of {filteredCharacters.length} characters
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

              {/* Character Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {paginatedCharacters.map((character) => (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    onLike={handleLike}
                  />
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

        {/* Story Creation CTA Section */}
        <section className="mt-20 mb-12">
          <div className="max-w-6xl mx-auto">
            {/* Main CTA Card */}
            <Card className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 border-0 shadow-glow/30">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-primary animate-pulse"></div>
                <div className="absolute top-12 right-8 w-6 h-6 rounded-full bg-accent animate-pulse delay-300"></div>
                <div className="absolute bottom-8 left-12 w-4 h-4 rounded-full bg-primary animate-pulse delay-700"></div>
                <div className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-accent/50 animate-pulse delay-500"></div>
              </div>

              <div className="relative p-12 text-center">
                <div className="mb-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-primary mb-6 shadow-glow">
                    <Sparkles className="w-10 h-10 text-primary-foreground animate-pulse" />
                  </div>
                  <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">
                    Bring Your Characters to Life! ✨
                  </h2>
                  <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    Your amazing characters are waiting for their next adventure. Create magical stories that will captivate young minds and spark imagination.
                  </p>
                </div>

                {/* Centered Action Button */}
                <div className="flex justify-center">
                  <Button 
                    size="lg" 
                    onClick={() => navigate('/create')}
                    className="group relative px-8 py-6 text-lg font-semibold bg-gradient-primary hover:shadow-glow/80 transition-all duration-300 transform hover:scale-105"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-white/20 group-hover:bg-white/30 transition-colors">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <span>Create New Story</span>
                    </div>
                  </Button>
                </div>
              </div>
            </Card>


            {/* Stats and Encouragement */}
            {characters.length > 0 && (
              <div className="mt-8 text-center">
                <p className="text-muted-foreground text-lg">
                  You have <span className="font-bold text-primary">{characters.length}</span> amazing character{characters.length !== 1 ? 's' : ''} ready for their next adventure!
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default Characters;