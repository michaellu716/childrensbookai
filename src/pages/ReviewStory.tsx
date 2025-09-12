import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Share, Save, RefreshCw, BookOpen, Edit3 } from "lucide-react";
import { StoryViewer } from "@/components/StoryViewer";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Footer } from "@/components/Footer";

const ReviewStory = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storyId = searchParams.get('storyId');
  const [currentPage, setCurrentPage] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [toneSlider, setToneSlider] = useState([50]);
  const [user, setUser] = useState<User | null>(null);

  // Check authentication status
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const getBackNavigation = () => {
    const referrer = searchParams.get('from');
    
    if (referrer === 'public-stories') {
      return { path: '/public-stories', label: 'Back to Gallery' };
    }
    
    if (user) {
      return { path: '/library', label: 'Back to Library' };
    }
    
    return { path: '/public-stories', label: 'Back to Gallery' };
  };
  
  // Mock story data for demo
  const [storyData, setStoryData] = useState({
    title: "Emma's Space Adventure",
    pages: [
      {
        image: "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=400&h=300&fit=crop&crop=center",
        text: "Once upon a time, Emma looked up at the twinkling stars and wondered what adventures awaited among them."
      },
      {
        image: "https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=400&h=300&fit=crop&crop=center",
        text: "She climbed aboard her magical rocket ship, painted in her favorite colors of purple and gold."
      },
      {
        image: "https://images.unsplash.com/photo-1614728263952-84ea256f9679?w=400&h=300&fit=crop&crop=center",
        text: "Emma zoomed past planets and dancing comets, making friends with a friendly alien named Zix."
      },
      {
        image: "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=400&h=300&fit=crop&crop=center",
        text: "Together, they explored crystal caves and helped lost space creatures find their way home."
      },
      {
        image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop&crop=center",
        text: "When it was time to return home, Emma promised Zix she would visit again in her dreams."
      },
      {
        image: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&h=300&fit=crop&crop=center",
        text: "Back in her cozy bedroom, Emma smiled as she drifted off to sleep, ready for tomorrow's adventures."
      }
    ]
  });

  const [editedText, setEditedText] = useState("");
  const [editedTitle, setEditedTitle] = useState(storyData.title);

  const handleEditPage = (pageIndex: number) => {
    setEditingPage(pageIndex);
    setEditedText(storyData.pages[pageIndex].text);
    setIsEditing(true);
  };

  const savePageEdit = () => {
    if (editingPage !== null) {
      setStoryData(prev => ({
        ...prev,
        pages: prev.pages.map((page, index) => 
          index === editingPage ? { ...page, text: editedText } : page
        )
      }));
    }
    setIsEditing(false);
    setEditingPage(null);
  };

  const regeneratePage = (pageIndex: number) => {
    // Mock regeneration - in real app would call API
    const newTexts = [
      "Emma gazed at the stars with wonder, dreaming of cosmic adventures that awaited her brave heart.",
      "Her magical spaceship sparkled with stardust as she prepared for the journey of a lifetime.",
      "Among the stars, Emma discovered that friendship knows no boundaries, not even in space.",
      "With Zix by her side, Emma learned that helping others brings the greatest joy in the universe.",
      "The promise of return filled Emma's heart with warmth as she bid farewell to her space friend.",
      "Safe in her bed, Emma knew that the best adventures begin with a curious heart and kind spirit."
    ];
    
    setStoryData(prev => ({
      ...prev,
      pages: prev.pages.map((page, index) => 
        index === pageIndex ? { ...page, text: newTexts[pageIndex] || page.text } : page
      )
    }));
  };

  const handleExport = () => {
    // Mock PDF generation
    alert("PDF download would start here! 📚");
  };

  const handleShare = () => {
    // Mock share functionality
    alert("Share link copied to clipboard! 🔗");
  };

  const handleSaveToLibrary = () => {
    // Mock save functionality
    alert("Story saved to your library! 💾");
    navigate('/library');
  };

  // If there's a storyId, use the new StoryViewer component
  if (storyId) {
    const backNav = getBackNavigation();
    
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-background/95 backdrop-blur">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => navigate(backNav.path)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backNav.label}
              </Button>
              <div className="flex items-center space-x-2">
                <BookOpen className="h-6 w-6 text-primary" />
                <span className="font-semibold">Story Review</span>
              </div>
              <div className="w-24" /> {/* Spacer for centering */}
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-4xl mx-auto">
            <StoryViewer storyId={storyId} isPublicView={!user} />
          </div>
        </div>
      </div>
    );
  }

  // Fallback to demo story viewer if no storyId
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate('/create')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Creator
            </Button>
            <div className="flex items-center space-x-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <span className="font-semibold">Story Review</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleSaveToLibrary}>
                <Save className="h-4 w-4" />
              </Button>
              <Button variant="hero" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Title Editor */}
          <div className="mb-8 text-center">
            {isEditing && editingPage === null ? (
              <div className="flex items-center justify-center gap-4">
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-2xl font-bold text-center max-w-md"
                />
                <Button size="sm" onClick={() => {
                  setStoryData(prev => ({ ...prev, title: editedTitle }));
                  setIsEditing(false);
                }}>
                  Save
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-3xl font-bold text-foreground">{storyData.title}</h1>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setEditedTitle(storyData.title);
                    setIsEditing(true);
                    setEditingPage(null);
                  }}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Global Controls */}
          <Card className="p-6 mb-8 bg-gradient-card">
            <h3 className="font-semibold mb-4">Story Adjustments</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Age-Appropriate Tone: {toneSlider[0] < 30 ? 'Very Simple' : toneSlider[0] < 70 ? 'Balanced' : 'More Advanced'}
                </label>
                <Slider
                  value={toneSlider}
                  onValueChange={setToneSlider}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate All
                </Button>
                <Button variant="outline" size="sm">
                  Simplify Language
                </Button>
                <Button variant="outline" size="sm">
                  Add More Detail
                </Button>
              </div>
            </div>
          </Card>

          {/* Story Pages */}
          <div className="grid lg:grid-cols-2 gap-8">
            {storyData.pages.map((page, index) => (
              <Card key={index} className="p-6 bg-gradient-card hover:shadow-card transition-all duration-300">
                <div className="space-y-4">
                  {/* Page Image */}
                  <div className="relative rounded-lg overflow-hidden">
                    <img 
                      src={page.image} 
                      alt={`Story page ${index + 1}`}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <Button variant="secondary" size="sm">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="absolute bottom-2 left-2">
                      <span className="bg-black/50 text-white px-2 py-1 rounded text-sm">
                        Page {index + 1}
                      </span>
                    </div>
                  </div>

                  {/* Page Text */}
                  <div className="space-y-2">
                    {isEditing && editingPage === index ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editedText}
                          onChange={(e) => setEditedText(e.target.value)}
                          className="min-h-[100px]"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={savePageEdit}>
                            Save
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setIsEditing(false);
                              setEditingPage(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-foreground leading-relaxed">{page.text}</p>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditPage(index)}
                          >
                            <Edit3 className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Export Actions */}
          <Card className="mt-8 p-6 bg-gradient-accent text-center">
            <h3 className="text-xl font-semibold mb-4 text-accent-foreground">
              Your Story is Ready! 🎉
            </h3>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="lg" onClick={handleExport}>
                <Download className="mr-2 h-5 w-5" />
                Download PDF
              </Button>
              <Button variant="outline" size="lg" onClick={handleShare}>
                <Share className="mr-2 h-5 w-5" />
                Share Link
              </Button>
              <Button variant="secondary" size="lg" onClick={handleSaveToLibrary}>
                <Save className="mr-2 h-5 w-5" />
                Save to Library
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ReviewStory;