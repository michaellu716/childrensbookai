import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { BookOpen, Sparkles, Download, Heart } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <BookOpen className="h-8 w-8" />,
      title: "Personalized Stories",
      description: "Create unique bedtime stories tailored to your child's interests and age"
    },
    {
      icon: <Sparkles className="h-8 w-8" />,
      title: "AI-Powered Magic",
      description: "Advanced AI generates beautiful illustrations and engaging narratives"
    },
    {
      icon: <Download className="h-8 w-8" />,
      title: "Beautiful PDFs",
      description: "Download professional-quality storybooks ready for printing"
    },
    {
      icon: <Heart className="h-8 w-8" />,
      title: "Safe & Age-Appropriate",
      description: "All content is carefully crafted to be safe and educational"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold bg-gradient-hero bg-clip-text text-transparent">
                StoryBookAI
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => navigate('/library')}>
                My Library
              </Button>
              <Button variant="outline">Sign In</Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
                Create Magical
                <span className="block text-primary-glow">Bedtime Stories</span>
              </h1>
              <p className="text-xl text-white/90 mb-8 max-w-2xl">
                Transform bedtime into an adventure! Create personalized AI-powered storybooks 
                featuring your child as the hero of their own magical tale.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button 
                  size="lg" 
                  variant="hero"
                  onClick={() => navigate('/create')}
                  className="text-lg px-8 py-4"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Create a Story
                </Button>
                <div className="flex flex-col xs:flex-row gap-3">
                  <Button 
                    size="lg" 
                    variant="outline" 
                    onClick={() => navigate('/public-stories')}
                    className="text-lg px-6 py-4 border-white/30 text-white hover:bg-white/10"
                  >
                    See Stories
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    onClick={() => navigate('/public-characters')}
                    className="text-lg px-6 py-4 border-white/30 text-white hover:bg-white/10"
                  >
                    See Characters
                  </Button>
                </div>
              </div>
              <div className="mt-8 p-4 bg-white/10 backdrop-blur rounded-lg border border-white/20">
                <p className="text-white/80 text-sm">
                  ✨ <strong>Safe & Educational:</strong> All stories are age-appropriate and promote positive values
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src={heroImage} 
                  alt="Parent and child reading magical storybook" 
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Parents Love StoryBookAI
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Create meaningful bedtime experiences that spark imagination and strengthen bonds
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="p-6 text-center hover:shadow-card transition-all duration-300 bg-gradient-card border-border/50">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4 text-primary">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-accent">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-accent-foreground mb-4">
            Ready to Create Magic?
          </h2>
          <p className="text-xl text-accent-foreground/90 mb-8 max-w-2xl mx-auto">
            Start crafting personalized bedtime stories that your child will treasure forever
          </p>
          <Button 
            size="lg" 
            variant="hero"
            onClick={() => navigate('/create')}
            className="text-lg px-8 py-4"
          >
            <BookOpen className="mr-2 h-5 w-5" />
            Start Creating Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <BookOpen className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold bg-gradient-hero bg-clip-text text-transparent">
                StoryBookAI
              </span>
            </div>
            <p className="text-muted-foreground">
              Creating magical bedtime experiences, one story at a time
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;