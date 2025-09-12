import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Sparkles, FileText, Users, ArrowRight, LogOut, Camera, Download, Edit3, PlayCircle, Palette, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { Footer } from "@/components/Footer";

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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <BookOpen className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold text-gradient">StoryBookAI</span>
            </div>
            <div className="flex items-center space-x-3">
              {user && (
                <span className="hidden sm:block text-sm text-muted-foreground px-3 py-1 rounded-full bg-muted/50">
                  Welcome, {user.email?.split('@')[0]}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={() => navigate('/library')} className="font-medium">
                <BookOpen className="mr-2 h-4 w-4" />
                My Library
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/characters')} className="font-medium">
                <Users className="mr-2 h-4 w-4" />
                Characters
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="font-medium">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6">
        {/* Hero Section */}
        <section className="py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex p-4 rounded-full bg-gradient-primary shadow-glow mb-8 animate-float">
              <Sparkles className="h-12 w-12 text-primary-foreground" />
            </div>
            <h1 className="text-6xl md:text-7xl font-bold mb-6 text-gradient leading-tight">
              Create Magical Stories
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
              Transform your child's world with personalized AI-generated stories. Upload their photo 
              to create custom cartoon characters and watch their adventures come to life.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => {
                  localStorage.removeItem('createStoryState');
                  navigate('/create');
                }} 
                className="text-lg px-10 py-6 shadow-glow hover:shadow-glow/80 transition-all"
              >
                Start Creating
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => navigate('/library')}
                className="text-lg px-10 py-6"
              >
                View Examples
                <BookOpen className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6 text-gradient">How StoryBookAI Works</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Create personalized stories in just a few simple steps. Our AI technology makes it easy to generate beautiful, illustrated storybooks with your child as the main character.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow group-hover:scale-110 transition-transform">
                  <Camera className="h-10 w-10 text-primary-foreground" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-accent rounded-full flex items-center justify-center text-accent-foreground font-bold text-sm">1</div>
              </div>
              <h3 className="text-xl font-semibold mb-3">Upload Photo</h3>
              <p className="text-muted-foreground leading-relaxed">Upload your child's photo to create a consistent cartoon character</p>
            </div>
            
            <div className="text-center group">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow group-hover:scale-110 transition-transform">
                  <Edit3 className="h-10 w-10 text-primary-foreground" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-accent rounded-full flex items-center justify-center text-accent-foreground font-bold text-sm">2</div>
              </div>
              <h3 className="text-xl font-semibold mb-3">Describe Story</h3>
              <p className="text-muted-foreground leading-relaxed">Tell us what kind of story you want - adventure, learning, bedtime, etc.</p>
            </div>
            
            <div className="text-center group">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow group-hover:scale-110 transition-transform">
                  <Sparkles className="h-10 w-10 text-primary-foreground" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-accent rounded-full flex items-center justify-center text-accent-foreground font-bold text-sm">3</div>
              </div>
              <h3 className="text-xl font-semibold mb-3">AI Generation</h3>
              <p className="text-muted-foreground leading-relaxed">Our AI creates a personalized story with beautiful illustrations</p>
            </div>
            
            <div className="text-center group">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow group-hover:scale-110 transition-transform">
                  <Download className="h-10 w-10 text-primary-foreground" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-accent rounded-full flex items-center justify-center text-accent-foreground font-bold text-sm">4</div>
              </div>
              <h3 className="text-xl font-semibold mb-3">Download & Share</h3>
              <p className="text-muted-foreground leading-relaxed">Download as PDF or share digitally with family and friends</p>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto">
            <Card className="p-16 bg-gradient-primary border-0 shadow-glow text-center text-primary-foreground">
              <h2 className="text-4xl font-bold mb-6">Ready to Begin the Adventure?</h2>
              <p className="text-xl mb-10 opacity-90 leading-relaxed">
                Join thousands of parents creating magical, personalized stories for their children.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  variant="secondary"
                  onClick={() => {
                    localStorage.removeItem('createStoryState');
                    navigate('/create');
                  }}
                  className="text-lg px-10 py-6 shadow-xl"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Create Your First Story
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => navigate('/library')}
                  className="text-lg px-10 py-6 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <FileText className="mr-2 h-5 w-5" />
                  Browse Examples
                </Button>
              </div>
            </Card>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default Index;
