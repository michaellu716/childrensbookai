import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Upload, Sparkles, BookOpen, Palette } from "lucide-react";
import { PhotoUpload } from "@/components/PhotoUpload";
import { AvatarStyleSelector } from "@/components/AvatarStyleSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const CreateStory = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [characterCreationError, setCharacterCreationError] = useState<string | null>(null);
  const [characterSheet, setCharacterSheet] = useState<any>(null);
  const [selectedAvatarStyle, setSelectedAvatarStyle] = useState<any>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<string>("");
  const [formData, setFormData] = useState({
    childName: "",
    age: "",
    themes: [] as string[],
    lesson: "",
    tone: "gentle",
    length: "2",
    photo: null as File | null,
    includePhoto: false,
    artStyle: "cartoon",
    readingLevel: "toddler",
    language: "english"
  });

  // Debug logging
  console.log('CreateStory render:', { currentStep, isGenerating, formData });

  // Persist minimal wizard state (avoid storing large images)
  useEffect(() => {
    console.log('Loading saved state from localStorage');
    try {
      const saved = localStorage.getItem('createStoryState');
      if (saved) {
        const state = JSON.parse(saved);
        console.log('Loaded state:', state);
        if (state.currentStep) setCurrentStep(state.currentStep);
        if (state.formData) setFormData((prev) => ({ ...prev, ...state.formData, photo: null }));
      }
    } catch (e) {
      console.warn('Failed to load saved state', e);
    }
  }, []);

  useEffect(() => {
    try {
      const { photo, ...safeForm } = formData;
      localStorage.setItem('createStoryState', JSON.stringify({ currentStep, formData: safeForm }));
    } catch (e) {
      console.warn('Failed to save state', e);
    }
  }, [currentStep, formData]);

  const storyPresets = [
    { name: "Space Adventure", themes: ["space", "adventure", "friendship"] },
    { name: "Kindness Quest", themes: ["kindness", "helping", "animals"] },
    { name: "Dino Detective", themes: ["dinosaurs", "mystery", "problem-solving"] },
    { name: "Ocean Explorer", themes: ["ocean", "discovery", "courage"] },
    { name: "Magic Garden", themes: ["nature", "magic", "growth"] },
    { name: "Superhero Training", themes: ["superheroes", "practice", "confidence"] }
  ];

  const handlePresetClick = (preset: typeof storyPresets[0]) => {
    setFormData(prev => ({ ...prev, themes: preset.themes }));
  };

  const toggleTheme = (theme: string) => {
    setFormData(prev => ({
      ...prev,
      themes: prev.themes.includes(theme) 
        ? prev.themes.filter(t => t !== theme)
        : [...prev.themes, theme]
    }));
  };

  const handlePhotoSelected = (file: File, preview: string) => {
    setFormData(prev => ({ ...prev, photo: file, includePhoto: true }));
    setUploadedPhoto(preview);
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, photo: null, includePhoto: false }));
    setUploadedPhoto("");
    setCharacterSheet(null);
    setSelectedAvatarStyle(null);
  };

  const createCharacterSheet = async (retryCount = 0) => {
    if (!formData.photo || !formData.childName) {
      toast.error("Please provide a photo and child's name");
      return;
    }

    // Prevent multiple simultaneous calls
    if (isCreatingCharacter) {
      toast.error("Character creation already in progress");
      return;
    }

    setIsCreatingCharacter(true);
    setCharacterCreationError(null); // Clear any previous errors
    
    try {
      // Convert file to base64 for API call
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const photoUrl = e.target?.result as string;
          
          const { data, error } = await supabase.functions.invoke('create-character-sheet', {
            body: {
              photoUrl,
              childName: formData.childName,
              childAge: formData.age
            }
          });

          if (error) {
            throw error;
          }

          setCharacterSheet(data.characterSheet);
          console.log('Character sheet created:', data.characterSheet);
          console.log('Generated avatars count:', data.characterSheet?.generatedAvatars?.length || 0);
          console.log('Generated avatars:', data.characterSheet?.generatedAvatars);
          toast.success("Character styles created! Choose your favorite.");
          
          // Automatically move to next step after successful character creation
          if (currentStep === 2) {
            setCurrentStep(3);
          }
        } catch (error: any) {
          handleCharacterCreationError(error);
        } finally {
          setIsCreatingCharacter(false);
        }
      };
      
      reader.onerror = () => {
        const error = new Error("Failed to read image file");
        handleCharacterCreationError(error);
        setIsCreatingCharacter(false);
      };
      
      reader.readAsDataURL(formData.photo);
    } catch (error: any) {
      handleCharacterCreationError(error);
      setIsCreatingCharacter(false);
    }
  };

  const handleCharacterCreationError = (error: any) => {
    console.error('Error creating character sheet:', error);
    
    let errorMessage = "Failed to create character. This might be due to OpenAI API limits.";
    
    // Handle rate limiting and API errors more gracefully
    if (error.message?.includes('Too Many Requests') || 
        error.message?.includes('rate limit') || 
        error.message?.includes('insufficient_quota') ||
        error.message?.includes('billing') ||
        error.message?.includes('429')) {
      errorMessage = "OpenAI API rate limit reached. You may need to add billing to your OpenAI account or wait before trying again.";
    } else if (error.message?.includes('Unexpected token')) {
      errorMessage = "Character analysis failed. The AI response format was invalid.";
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    toast.error(errorMessage);
    setCharacterCreationError(errorMessage);
  };

  const skipPhotoFeature = () => {
    setFormData(prev => ({ ...prev, includePhoto: false, photo: null }));
    setUploadedPhoto("");
    setCharacterSheet(null);
    setSelectedAvatarStyle(null);
    toast.success("Skipped photo feature. You can still create amazing stories!");
    // Skip to style & format step (step 3 when no photo)
    setCurrentStep(3);
  };

  const handleAvatarStyleSelect = (style: any) => {
    setSelectedAvatarStyle(style);
  };

  const handleGenerate = async () => {
    if (!formData.childName || formData.themes.length === 0) {
      toast.error("Please provide child's name and select at least one theme");
      return;
    }

    // Only require avatar selection if we have avatars available AND photo is included
    const hasAvatars = (characterSheet?.generatedAvatars?.length || 0) > 0;
    if (formData.includePhoto && hasAvatars && !selectedAvatarStyle) {
      toast.error("Please select an avatar style for your character");
      return;
    }

    // Prevent multiple simultaneous calls
    if (isGenerating) {
      toast.error("Story generation already in progress");
      return;
    }

    setIsGenerating(true);
    
    try {
      // Get the current session to ensure we have valid auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast.error("Authentication required. Please sign in again.");
        setIsGenerating(false);
        return;
      }

      const storyPrompt = `Create a ${formData.tone} story for ${formData.childName} (age ${formData.age}) featuring themes: ${formData.themes.join(", ")}. ${formData.lesson ? `Include the lesson: ${formData.lesson}.` : ""}`;
      
      const { data, error } = await supabase.functions.invoke('generate-story-with-character', {
        body: {
          storyPrompt,
          characterSheet,
          selectedAvatarStyle,
          storySettings: {
            childName: formData.childName,
            childAge: formData.age,
            length: parseInt(formData.length),
            tone: formData.tone,
            themes: formData.themes,
            lesson: formData.lesson,
            readingLevel: formData.readingLevel,
            language: formData.language
          }
        }
      });

      if (error) {
        throw error;
      }

      // Navigate to review with story ID
      navigate(`/review?storyId=${data.storyId}`);
      
    } catch (error: any) {
      console.error('Error generating story:', error);
      if (error.message?.includes('not authenticated')) {
        toast.error("Authentication error. Please sign in again.");
      } else if (error.message?.includes('Too Many Requests') || 
                 error.message?.includes('rate limit') || 
                 error.message?.includes('429')) {
        toast.error("OpenAI API rate limit reached. Please wait a few minutes before trying again.");
      } else {
        toast.error(error.message || "Failed to generate story. Please try again.");
      }
      setIsGenerating(false);
    }
  };

  const nextStep = async () => {
    // Validate step 1
    if (currentStep === 1 && (!formData.childName || formData.themes.length === 0)) {
      toast.error("Please provide child's name and select at least one theme");
      return;
    }
    
    // Handle photo upload step
    if (currentStep === 2 && formData.includePhoto && formData.photo) {
      if (!characterSheet) {
        await createCharacterSheet();
        return;
      }
    }
    
    // Validate character selection. If no avatars were generated, allow skipping this step.
    if (currentStep === 3 && formData.includePhoto) {
      const hasAvatars = (characterSheet?.generatedAvatars?.length || 0) > 0;
      if (hasAvatars && !selectedAvatarStyle) {
        toast.error("Please select an avatar style");
        return;
      }
      // If no avatars, automatically proceed (skip the selection)
      if (!hasAvatars) {
        console.log('No avatars generated, proceeding without selection');
      }
    }
    
    if (currentStep < (formData.includePhoto ? 5 : 4)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  if (isGenerating) {
    console.log('Rendering generating state');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md p-8 text-center bg-gradient-card">
          <div className="mb-6">
            <Sparkles className="h-16 w-16 mx-auto text-primary animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Creating Your Story...</h2>
          <p className="text-muted-foreground mb-6">
            Our AI is crafting a magical tale just for {formData.childName || "your child"}
          </p>
          <Progress value={66} className="mb-4" />
          <p className="text-sm text-muted-foreground">Generating illustrations and text...</p>
        </Card>
      </div>
    );
  }

  console.log('Rendering main CreateStory component', { currentStep });

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            <div className="flex items-center space-x-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <span className="font-semibold">Story Creator</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Step {currentStep} of {formData.includePhoto ? 5 : 4}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <Progress value={(currentStep / (formData.includePhoto ? 5 : 4)) * 100} className="mb-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span className={currentStep >= 1 ? "text-primary font-medium" : ""}>Story Details</span>
            <span className={currentStep >= 2 ? "text-primary font-medium" : ""}>Photo Upload</span>
            {formData.includePhoto && (
              <span className={currentStep >= 3 ? "text-primary font-medium" : ""}>Character Style</span>
            )}
            <span className={currentStep >= (formData.includePhoto ? 4 : 3) ? "text-primary font-medium" : ""}>Style & Format</span>
            <span className={currentStep >= (formData.includePhoto ? 5 : 4) ? "text-primary font-medium" : ""}>Generate</span>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Step 1: Story Details */}
          {currentStep === 1 && (
            <Card className="p-8 bg-gradient-card">
              <h2 className="text-2xl font-bold mb-6 text-center">Tell Us About Your Story</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="childName">Child's Name</Label>
                    <Input
                      id="childName"
                      value={formData.childName}
                      onChange={(e) => setFormData(prev => ({ ...prev, childName: e.target.value }))}
                      placeholder="Emma"
                    />
                  </div>
                  <div>
                    <Label htmlFor="age">Age</Label>
                    <Select value={formData.age} onValueChange={(value) => setFormData(prev => ({ ...prev, age: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select age" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2-3">2-3 years</SelectItem>
                        <SelectItem value="4-5">4-5 years</SelectItem>
                        <SelectItem value="6-7">6-7 years</SelectItem>
                        <SelectItem value="8-10">8-10 years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Story Presets</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {storyPresets.map((preset) => (
                      <Button
                        key={preset.name}
                        variant="outline"
                        onClick={() => handlePresetClick(preset)}
                        className="h-auto p-3 text-left justify-start"
                      >
                        <div>
                          <div className="font-medium">{preset.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {preset.themes.join(", ")}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Selected Themes</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.themes.map((theme) => (
                      <Badge
                        key={theme}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => toggleTheme(theme)}
                      >
                        {theme} ×
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="lesson">Lesson or Message (Optional)</Label>
                  <Input
                    id="lesson"
                    value={formData.lesson}
                    onChange={(e) => setFormData(prev => ({ ...prev, lesson: e.target.value }))}
                    placeholder="e.g., Being brave, sharing with friends"
                  />
                </div>

                <div>
                  <Label>Story Tone</Label>
                  <Select value={formData.tone} onValueChange={(value) => setFormData(prev => ({ ...prev, tone: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gentle">Gentle & Calming</SelectItem>
                      <SelectItem value="adventurous">Adventurous & Exciting</SelectItem>
                      <SelectItem value="funny">Funny & Playful</SelectItem>
                      <SelectItem value="educational">Educational & Learning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          )}

          {/* Step 2: Photo Upload */}
          {currentStep === 2 && (
            <Card className="p-8 bg-gradient-card">
              <h2 className="text-2xl font-bold mb-6 text-center">Add Your Child's Photo (Optional)</h2>
              
              <PhotoUpload
                onPhotoSelected={handlePhotoSelected}
                selectedPhoto={uploadedPhoto}
                onRemovePhoto={handleRemovePhoto}
              />
              
              {formData.photo && !characterSheet && (
                <div className="mt-6 space-y-4">
                  {characterCreationError && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm font-medium text-destructive mb-2">❌ Character Creation Failed</p>
                      <p className="text-xs text-destructive/80 mb-3">{characterCreationError}</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCharacterCreationError(null);
                            createCharacterSheet();
                          }}
                          disabled={isCreatingCharacter}
                          size="sm"
                        >
                          Try Again
                        </Button>
                        <Button
                          variant="outline"
                          onClick={skipPhotoFeature}
                          disabled={isCreatingCharacter}
                          size="sm"
                        >
                          Skip Photo Feature
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {!characterCreationError && (
                    <Button
                      onClick={() => createCharacterSheet()}
                      disabled={isCreatingCharacter}
                      className="w-full"
                    >
                      {isCreatingCharacter ? (
                        <>Creating Character Styles...</>
                      ) : (
                        <>Create Cartoon Character</>
                      )}
                    </Button>
                  )}
                  
                  <div className="text-center space-y-3">
                    <p className="text-xs text-muted-foreground">
                      This will analyze the photo and create cartoon versions
                    </p>
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-800">
                      <p className="text-sm font-medium mb-2 text-amber-800 dark:text-amber-200">⚠️ OpenAI API Required</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                        Photo features require OpenAI API credits. If you haven't added billing to your OpenAI account, this will fail.
                      </p>
                      {!characterCreationError && (
                        <Button
                          variant="outline"
                          onClick={skipPhotoFeature}
                          disabled={isCreatingCharacter}
                          className="w-full"
                        >
                          Skip Photo Feature & Continue
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {characterSheet && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-success font-medium mb-2">
                    ✓ Character styles created! You can now proceed to the next step.
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Step 3: Character Style Selection */}
          {currentStep === 3 && formData.includePhoto && (
            <Card className="p-8 bg-gradient-card">
              <AvatarStyleSelector
                avatarStyles={characterSheet?.generatedAvatars || []}
                selectedStyle={selectedAvatarStyle}
                onStyleSelect={handleAvatarStyleSelect}
                isLoading={isCreatingCharacter}
                onBack={() => setCurrentStep(2)}
                onRetry={() => createCharacterSheet()}
                onSkip={skipPhotoFeature}
              />
            </Card>
          )}

          {/* Step 4/3: Style & Format */}
          {currentStep === (formData.includePhoto ? 4 : 3) && (
            <Card className="p-8 bg-gradient-card">
              <h2 className="text-2xl font-bold mb-6 text-center">Choose Style & Format</h2>
              
              <div className="space-y-6">
                <div>
                  <Label>Art Style</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    {[
                      { value: "cartoon", label: "Cartoon", desc: "Bright and playful" },
                      { value: "watercolor", label: "Watercolor", desc: "Soft and dreamy" },
                      { value: "crayon", label: "Crayon Art", desc: "Hand-drawn feel" },
                      { value: "comic", label: "Comic Book", desc: "Bold and dynamic" }
                    ].map((style) => (
                      <Button
                        key={style.value}
                        variant={formData.artStyle === style.value ? "default" : "outline"}
                        onClick={() => setFormData(prev => ({ ...prev, artStyle: style.value }))}
                        className="h-auto p-4 text-left justify-start"
                      >
                        <div>
                          <div className="font-medium">{style.label}</div>
                          <div className="text-xs text-muted-foreground">{style.desc}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Book Length</Label>
                    <Select value={formData.length} onValueChange={(value) => setFormData(prev => ({ ...prev, length: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="8">8 pages (Quick read)</SelectItem>
                        <SelectItem value="12">12 pages (Standard)</SelectItem>
                        <SelectItem value="16">16 pages (Extended)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Reading Level</Label>
                    <Select value={formData.readingLevel} onValueChange={(value) => setFormData(prev => ({ ...prev, readingLevel: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="toddler">Toddler (Simple words)</SelectItem>
                        <SelectItem value="early">Early Reader (Short sentences)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Language</Label>
                  <Select value={formData.language} onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="spanish">Spanish</SelectItem>
                      <SelectItem value="french">French</SelectItem>
                      <SelectItem value="german">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          )}

          {/* Step 5/4: Generate */}
          {currentStep === (formData.includePhoto ? 5 : 4) && (
            <Card className="p-8 bg-gradient-card text-center">
              <Sparkles className="h-16 w-16 mx-auto text-primary mb-6" />
              <h2 className="text-2xl font-bold mb-4">Ready to Create Magic!</h2>
              
              <div className="bg-muted/50 rounded-lg p-6 mb-6 text-left">
                <h3 className="font-semibold mb-3">Story Summary:</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Child:</strong> {formData.childName || "Not specified"}, {formData.age || "Age not specified"}</p>
                  <p><strong>Themes:</strong> {formData.themes.join(", ") || "None selected"}</p>
                  <p><strong>Style:</strong> {formData.artStyle} art, {formData.length} pages</p>
                  <p><strong>Level:</strong> {formData.readingLevel} reader in {formData.language}</p>
                  {formData.lesson && <p><strong>Lesson:</strong> {formData.lesson}</p>}
                  {formData.photo && <p><strong>Photo:</strong> Character will be included</p>}
                </div>
              </div>

              <Button 
                size="lg" 
                variant="hero" 
                onClick={handleGenerate}
                className="text-lg px-8 py-4"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Generate My Story
              </Button>
              
              <p className="text-sm text-muted-foreground mt-4">
                This usually takes 2-3 minutes. We'll create beautiful illustrations and engaging text.
              </p>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button 
              variant="outline" 
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            
            {currentStep < (formData.includePhoto ? 5 : 4) ? (
              <Button onClick={nextStep}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
           </div>
         </div>
       </div>
     </div>
   </ErrorBoundary>
 );
};

export default CreateStory;