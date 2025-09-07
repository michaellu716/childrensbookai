import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { BookOpen, Search, Plus, Download, Share, Copy, Trash2, Filter } from "lucide-react";

const Library = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");

  // Mock library data
  const stories = [
    {
      id: 1,
      title: "Emma's Space Adventure",
      childName: "Emma",
      age: "4-5",
      themes: ["space", "adventure", "friendship"],
      artStyle: "cartoon",
      pages: 8,
      createdAt: "2024-01-15",
      thumbnail: "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=300&h=200&fit=crop&crop=center",
      status: "completed"
    },
    {
      id: 2,
      title: "Oliver's Dino Detective Story",
      childName: "Oliver",
      age: "6-7",
      themes: ["dinosaurs", "mystery", "problem-solving"],
      artStyle: "comic",
      pages: 12,
      createdAt: "2024-01-10",
      thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300&h=200&fit=crop&crop=center",
      status: "completed"
    },
    {
      id: 3,
      title: "Lily's Magic Garden",
      childName: "Lily",
      age: "2-3",
      themes: ["nature", "magic", "growth"],
      artStyle: "watercolor",
      pages: 8,
      createdAt: "2024-01-08",
      thumbnail: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=300&h=200&fit=crop&crop=center",
      status: "completed"
    },
    {
      id: 4,
      title: "Max's Superhero Training",
      childName: "Max",
      age: "8-10",
      themes: ["superheroes", "practice", "confidence"],
      artStyle: "comic",
      pages: 16,
      createdAt: "2024-01-05",
      thumbnail: "https://images.unsplash.com/photo-1635805737707-575885ab0820?w=300&h=200&fit=crop&crop=center",
      status: "draft"
    }
  ];

  const filteredStories = stories.filter(story => {
    const matchesSearch = story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         story.childName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         story.themes.some(theme => theme.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = selectedFilter === "all" || 
                         (selectedFilter === "completed" && story.status === "completed") ||
                         (selectedFilter === "drafts" && story.status === "draft");
    
    return matchesSearch && matchesFilter;
  });

  const handleDuplicate = (storyId: number) => {
    const story = stories.find(s => s.id === storyId);
    if (story) {
      alert(`Creating a new story based on "${story.title}"...`);
      navigate('/create');
    }
  };

  const handleDelete = (storyId: number) => {
    const story = stories.find(s => s.id === storyId);
    if (story && confirm(`Are you sure you want to delete "${story.title}"?`)) {
      alert("Story deleted successfully!");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => navigate('/')}>
                <BookOpen className="mr-2 h-4 w-4" />
                StoryDreams
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
                Completed ({stories.filter(s => s.status === "completed").length})
              </Button>
              <Button
                variant={selectedFilter === "drafts" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("drafts")}
              >
                Drafts ({stories.filter(s => s.status === "draft").length})
              </Button>
            </div>
          </div>
        </div>

        {/* Stories Grid */}
        {filteredStories.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-card">
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery ? "No stories found" : "No stories yet"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery 
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
                {/* Thumbnail */}
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={story.thumbnail} 
                    alt={story.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute top-3 right-3">
                    <Badge variant={story.status === "completed" ? "default" : "secondary"}>
                      {story.status === "completed" ? "✓ Complete" : "📝 Draft"}
                    </Badge>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <div className="text-white text-sm font-medium">
                      {story.pages} pages • {story.artStyle}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-lg line-clamp-1">{story.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        For {story.childName}, ages {story.age}
                      </p>
                    </div>

                    {/* Themes */}
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

                    <div className="text-xs text-muted-foreground">
                      Created {new Date(story.createdAt).toLocaleDateString()}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 pt-2">
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => navigate('/review')}
                        className="flex-1"
                      >
                        {story.status === "completed" ? "View" : "Continue"}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDuplicate(story.id)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {story.status === "completed" && (
                        <>
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Share className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDelete(story.id)}
                        className="text-destructive hover:text-destructive"
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
                <div className="text-2xl font-bold">{stories.filter(s => s.status === "completed").length}</div>
                <div className="text-sm opacity-90">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{[...new Set(stories.map(s => s.childName))].length}</div>
                <div className="text-sm opacity-90">Characters</div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Library;