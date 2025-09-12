import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Heart, Sparkles, ArrowLeft } from "lucide-react";
import { CharacterCard } from "@/components/CharacterCard";
import { useCharactersQuery } from "@/hooks/useCharactersQuery";
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";

export default function PublicCharacters() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: characters = [], isLoading, error } = useCharactersQuery();
  const navigate = useNavigate();
  const { toast } = useToast();

  const filteredCharacters = characters.filter(character =>
    character.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    character.hair_color?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    character.eye_color?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    character.typical_outfit?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLike = (characterId: string) => {
    toast({
      title: "Sign up to like characters",
      description: "Create an account to save your favorite characters and create stories with them!",
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md w-full mx-4 text-center">
          <h2 className="text-2xl font-bold mb-4 text-destructive">Oops!</h2>
          <p className="text-muted-foreground mb-4">
            We couldn't load the characters right now. Please try again later.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost" 
                size="sm"
                onClick={() => navigate(-1)}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gradient">Character Gallery</h1>
                  <p className="text-sm text-muted-foreground">Discover amazing characters</p>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => navigate('/auth')}
              className="bg-gradient-primary text-primary-foreground hover:opacity-90"
            >
              Sign Up to Create
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Search and Stats */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search characters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-sm">
              <Heart className="h-3 w-3 mr-1" />
              {characters.reduce((sum, char) => sum + (char.likes || 0), 0)} total likes
            </Badge>
            <Badge variant="outline" className="text-sm">
              {filteredCharacters.length} character{filteredCharacters.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>

        {/* Characters Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-muted rounded-lg mb-4"></div>
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : filteredCharacters.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">No characters found</h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm ? 
                `No characters match "${searchTerm}". Try adjusting your search.` : 
                "No characters have been created yet. Be the first to create one!"
              }
            </p>
            <Button onClick={() => navigate('/auth')} className="bg-gradient-primary">
              <Sparkles className="h-4 w-4 mr-2" />
              Create Your First Character
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCharacters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                onLike={handleLike}
              />
            ))}
          </div>
        )}

        {/* Call to Action */}
        {filteredCharacters.length > 0 && (
          <Card className="mt-12 p-8 text-center bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5">
            <div className="text-4xl mb-4">✨</div>
            <h3 className="text-2xl font-bold mb-3 text-gradient">Ready to Create Your Own?</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Join thousands of parents creating magical, personalized stories with custom characters just like these!
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate('/auth')}
              className="bg-gradient-primary text-primary-foreground hover:opacity-90"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Start Creating Stories
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}