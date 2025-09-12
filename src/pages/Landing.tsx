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
      <nav className="border-b border-border/20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/80 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => navigate('/')}>
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                StoryBookAI
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/library')}
                className="text-foreground hover:text-primary transition-colors"
              >
                My Library
              </Button>
              <Button 
                onClick={() => navigate('/auth')}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-6 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 shadow-lg"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 min-h-[90vh] flex items-center">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-32 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="text-center lg:text-left space-y-8">
              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight animate-fade-in">
                  Create Magical
                  <span className="block bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                    Bedtime Stories
                  </span>
                </h1>
                <p className="text-xl md:text-2xl text-white/90 max-w-2xl animate-fade-in delay-200">
                  Transform bedtime into an adventure! Create personalized AI-powered storybooks 
                  featuring your child as the hero of their own magical tale.
                </p>
              </div>
              
              {/* Primary CTA */}
              <div className="animate-fade-in delay-400">
                <Button 
                  size="lg" 
                  onClick={() => navigate('/create')}
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-gray-900 font-bold text-xl px-10 py-6 rounded-2xl shadow-2xl hover:shadow-yellow-500/25 transition-all duration-300 hover:scale-105 group"
                >
                  <Sparkles className="mr-3 h-6 w-6 group-hover:rotate-12 transition-transform" />
                  Start Creating Magic
                </Button>
              </div>
              
              {/* Secondary CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in delay-600">
                <Button 
                  size="lg" 
                  variant="secondary"
                  onClick={() => navigate('/public-stories')}
                  className="bg-white/10 hover:bg-white/20 text-white border-2 border-white/30 hover:border-white/50 text-lg px-8 py-4 rounded-xl backdrop-blur-sm transition-all duration-300 hover:scale-105"
                >
                  <BookOpen className="mr-2 h-5 w-5" />
                  Browse Stories
                </Button>
                <Button 
                  size="lg" 
                  variant="secondary"
                  onClick={() => navigate('/public-characters')}
                  className="bg-white/10 hover:bg-white/20 text-white border-2 border-white/30 hover:border-white/50 text-lg px-8 py-4 rounded-xl backdrop-blur-sm transition-all duration-300 hover:scale-105"
                >
                  <Heart className="mr-2 h-5 w-5" />
                  Meet Characters
                </Button>
              </div>
              
              {/* Trust indicator */}
              <div className="animate-fade-in delay-800">
                <div className="flex items-center justify-center lg:justify-start gap-6 mt-8">
                  <div className="flex items-center gap-2 text-white/80">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Safe & Educational</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-200"></div>
                    <span className="text-sm font-medium">AI-Powered</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-400"></div>
                    <span className="text-sm font-medium">Personalized</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative animate-scale-in delay-300">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl hover:shadow-purple-500/25 transition-all duration-500 hover:scale-105 group">
                <img 
                  src={heroImage} 
                  alt="Parent and child reading magical storybook" 
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/30 via-transparent to-transparent group-hover:from-purple-900/20 transition-all duration-300"></div>
                
                {/* Floating elements */}
                <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm rounded-full p-3 animate-bounce delay-1000">
                  <Sparkles className="h-6 w-6 text-yellow-300" />
                </div>
                <div className="absolute bottom-4 left-4 bg-white/20 backdrop-blur-sm rounded-full p-3 animate-bounce delay-1500">
                  <BookOpen className="h-6 w-6 text-blue-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Why Parents Love StoryBookAI
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Create meaningful bedtime experiences that spark imagination and strengthen bonds with your child
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group p-8 text-center hover:shadow-xl transition-all duration-300 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg hover:scale-105 animate-fade-in"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-2xl mb-6 text-white group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-4 text-foreground group-hover:text-primary transition-colors">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute top-10 left-10 w-4 h-4 bg-white rounded-full animate-pulse"></div>
            <div className="absolute top-20 right-20 w-2 h-2 bg-white rounded-full animate-pulse delay-300"></div>
            <div className="absolute bottom-20 left-20 w-3 h-3 bg-white rounded-full animate-pulse delay-700"></div>
            <div className="absolute bottom-10 right-10 w-2 h-2 bg-white rounded-full animate-pulse delay-1000"></div>
          </div>
        </div>
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Create Magic?
            </h2>
            <p className="text-xl text-white/90 mb-10 max-w-3xl mx-auto leading-relaxed">
              Join thousands of parents creating personalized bedtime stories that spark imagination, 
              teach valuable lessons, and create lasting memories with their children.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Button 
                size="lg" 
                onClick={() => navigate('/create')}
                className="bg-white hover:bg-gray-100 text-purple-600 font-bold text-xl px-12 py-6 rounded-2xl shadow-2xl hover:shadow-white/25 transition-all duration-300 hover:scale-105 group"
              >
                <BookOpen className="mr-3 h-6 w-6 group-hover:rotate-12 transition-transform" />
                Start Your Story Journey
              </Button>
              
              <div className="flex items-center gap-4 text-white/80">
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full border-2 border-white flex items-center justify-center text-sm font-bold text-gray-900">
                    👶
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full border-2 border-white flex items-center justify-center text-sm font-bold">
                    👧
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full border-2 border-white flex items-center justify-center text-sm font-bold">
                    👦
                  </div>
                </div>
                <span className="text-sm font-medium">Join 10k+ happy families</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/10 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-6 group">
              <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                StoryBookAI
              </span>
            </div>
            <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
              Creating magical bedtime experiences, one story at a time
            </p>
            <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <span>🌟 Safe & Educational</span>
              <span>🎨 AI-Powered</span>
              <span>❤️ Made with Love</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;