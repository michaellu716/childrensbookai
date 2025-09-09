import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Sparkles, FileText, Users, ArrowRight, LogOut, Camera, Download, Edit3, PlayCircle, Palette, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Error signing out');
    } else {
      toast.success('Signed out successfully');
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">StoryBookAI</span>
            </div>
            <div className="flex items-center space-x-4">
              {user && (
                <span className="text-sm text-muted-foreground">
                  Welcome, {user.email}
                </span>
              )}
              <Button variant="ghost" onClick={() => navigate('/library')}>
                <BookOpen className="mr-2 h-4 w-4" />
                My Library
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <Sparkles className="h-16 w-16 text-primary animate-pulse" />
          </div>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary via-primary/80 to-secondary bg-clip-text text-transparent">
            Create Magical Stories
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Transform your child's world with personalized AI-generated stories. Upload their photo 
            to create custom cartoon characters and watch their adventures come to life.
          </p>
          <Button 
            size="lg" 
            onClick={() => navigate('/create')} 
            className="text-lg px-8 py-4"
          >
            Start Creating
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="p-8 text-center bg-gradient-card hover:shadow-lg transition-shadow">
            <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-3">Create Stories</h3>
            <p className="text-muted-foreground mb-4">
              Generate personalized stories with your child as the main character. 
              Choose themes, lessons, and adventure settings.
            </p>
            <Button variant="outline" onClick={() => navigate('/create')}>
              Get Started
            </Button>
          </Card>

          <Card className="p-8 text-center bg-gradient-card hover:shadow-lg transition-shadow">
            <Users className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-3">Photo Characters</h3>
            <p className="text-muted-foreground mb-4">
              Upload your child's photo and our AI will create consistent cartoon 
              characters for their stories.
            </p>
            <Button variant="outline" onClick={() => navigate('/create')}>
              Try It Now
            </Button>
          </Card>

          <Card className="p-8 text-center bg-gradient-card hover:shadow-lg transition-shadow">
            <FileText className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-3">Story Library</h3>
            <p className="text-muted-foreground mb-4">
              Save and organize all your created stories. Access them anytime 
              and share with family and friends.
            </p>
            <Button variant="outline" onClick={() => navigate('/library')}>
              View Library
            </Button>
          </Card>
        </div>

        {/* How It Works Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-4">How StoryBookAI Works</h2>
          <p className="text-lg text-muted-foreground text-center mb-12 max-w-3xl mx-auto">
            Create personalized stories in just a few simple steps. Our AI technology makes it easy to generate beautiful, illustrated storybooks with your child as the main character.
          </p>
          
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">1. Upload Photo</h3>
              <p className="text-sm text-muted-foreground">Upload your child's photo to create a consistent cartoon character</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Edit3 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">2. Describe Story</h3>
              <p className="text-sm text-muted-foreground">Tell us what kind of story you want - adventure, learning, bedtime, etc.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">3. AI Generation</h3>
              <p className="text-sm text-muted-foreground">Our AI creates a personalized story with beautiful illustrations</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">4. Download & Share</h3>
              <p className="text-sm text-muted-foreground">Download as PDF or share digitally with family and friends</p>
            </div>
          </div>
        </div>

        {/* Tutorials & Guides */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-4">What would you like to do?</h2>
          <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Explore all the features StoryBookAI has to offer. From creating your first story to managing your library.
          </p>
          
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
            <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/create')}>
              <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Create a Story</h3>
              <p className="text-sm text-muted-foreground mb-4">Start from scratch with your own story idea and let AI bring it to life</p>
              <Button variant="outline" size="sm">Get Started</Button>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/create')}>
              <Camera className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Upload Photo</h3>
              <p className="text-sm text-muted-foreground mb-4">Create consistent cartoon characters by uploading your child's photo</p>
              <Button variant="outline" size="sm">Try It Now</Button>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/library')}>
              <FileText className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Manage Library</h3>
              <p className="text-sm text-muted-foreground mb-4">View, organize and manage all your created stories in one place</p>
              <Button variant="outline" size="sm">View Library</Button>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <Download className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Download PDF</h3>
              <p className="text-sm text-muted-foreground mb-4">Export your stories as high-quality PDF files for printing or sharing</p>
              <Button variant="outline" size="sm">Learn More</Button>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <PlayCircle className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Story Preview</h3>
              <p className="text-sm text-muted-foreground mb-4">Preview your stories before downloading with our interactive story viewer</p>
              <Button variant="outline" size="sm">Learn More</Button>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/create')}>
              <Palette className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Choose Themes</h3>
              <p className="text-sm text-muted-foreground mb-4">Select from various story themes like adventure, learning, or bedtime stories</p>
              <Button variant="outline" size="sm">Explore Themes</Button>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <Users className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Multiple Characters</h3>
              <p className="text-sm text-muted-foreground mb-4">Add friends, family members, or pets as characters in your stories</p>
              <Button variant="outline" size="sm">Learn More</Button>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <Star className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Story Templates</h3>
              <p className="text-sm text-muted-foreground mb-4">Use pre-made story templates for faster creation with proven story structures</p>
              <Button variant="outline" size="sm">Coming Soon</Button>
            </Card>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <Card className="p-12 bg-gradient-card max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">Ready to Begin the Adventure?</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Join thousands of parents creating magical, personalized stories for their children.
            </p>
            <Button 
              size="lg" 
              variant="hero"
              onClick={() => navigate('/create')}
              className="text-lg px-8 py-4"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Create Your First Story
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
