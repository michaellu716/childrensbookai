import { useState } from "react";
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

const CreateStory = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    childName: "",
    age: "",
    themes: [] as string[],
    lesson: "",
    tone: "gentle",
    length: "8",
    photo: null as File | null,
    includePhoto: false,
    artStyle: "cartoon",
    readingLevel: "toddler",
    language: "english"
  });

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

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, photo: file }));
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    // Simulate generation process
    setTimeout(() => {
      navigate('/review');
    }, 3000);
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  if (isGenerating) {
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

  return (
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
              Step {currentStep} of 4
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <Progress value={(currentStep / 4) * 100} className="mb-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span className={currentStep >= 1 ? "text-primary font-medium" : ""}>Story Details</span>
            <span className={currentStep >= 2 ? "text-primary font-medium" : ""}>Photo Upload</span>
            <span className={currentStep >= 3 ? "text-primary font-medium" : ""}>Style & Format</span>
            <span className={currentStep >= 4 ? "text-primary font-medium" : ""}>Generate</span>
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
              
              <div className="space-y-6">
                <div className="text-center">
                  <div className="border-2 border-dashed border-border rounded-lg p-12 bg-muted/30">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <div className="space-y-2">
                      <p className="text-lg font-medium">Upload a photo of your child</p>
                      <p className="text-sm text-muted-foreground">
                        We'll create a cartoon character based on this photo
                      </p>
                    </div>
                    <Button variant="outline" className="mt-4" asChild>
                      <label htmlFor="photo-upload" className="cursor-pointer">
                        Choose Photo
                        <input
                          id="photo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="sr-only"
                        />
                      </label>
                    </Button>
                  </div>
                </div>

                {formData.photo && (
                  <div className="text-center">
                    <p className="text-sm text-success font-medium">
                      ✓ Photo uploaded: {formData.photo.name}
                    </p>
                    <div className="flex items-center justify-center mt-4">
                      <input
                        type="checkbox"
                        id="include-photo"
                        checked={formData.includePhoto}
                        onChange={(e) => setFormData(prev => ({ ...prev, includePhoto: e.target.checked }))}
                        className="mr-2"
                      />
                      <Label htmlFor="include-photo">
                        Include cartoon character based on this photo
                      </Label>
                    </div>
                  </div>
                )}

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Tips for best results:</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Use a clear, close-up photo of your child's face</li>
                    <li>• Good lighting works best</li>
                    <li>• JPG, PNG, or WebP formats supported</li>
                    <li>• We'll automatically crop to focus on the face</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {/* Step 3: Style & Format */}
          {currentStep === 3 && (
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

          {/* Step 4: Generate */}
          {currentStep === 4 && (
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
            
            {currentStep < 4 ? (
              <Button onClick={nextStep}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateStory;