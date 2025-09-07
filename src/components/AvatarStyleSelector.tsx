import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';

interface AvatarStyle {
  style: string;
  imageUrl: string;
  prompt: string;
}

interface AvatarStyleSelectorProps {
  avatarStyles: AvatarStyle[];
  selectedStyle?: AvatarStyle;
  onStyleSelect: (style: AvatarStyle) => void;
  isLoading?: boolean;
}

export const AvatarStyleSelector: React.FC<AvatarStyleSelectorProps> = ({
  avatarStyles,
  selectedStyle,
  onStyleSelect,
  isLoading = false
}) => {
  // Debug logging
  console.log('AvatarStyleSelector props:', {
    avatarStyles,
    avatarStylesLength: avatarStyles?.length,
    selectedStyle,
    isLoading
  });

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <h3 className="text-lg font-semibold mb-2">Creating Character Styles</h3>
        <p className="text-muted-foreground">
          We're analyzing the photo and generating cartoon avatar options...
        </p>
      </Card>
    );
  }

  // Handle case when no avatar styles are available
  if (!avatarStyles || avatarStyles.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h3 className="text-lg font-semibold mb-2">Choose Your Child's Cartoon Style</h3>
        <p className="text-muted-foreground mb-4">
          No avatar styles available. The image generation may have failed due to API limits.
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Debug info: Received {avatarStyles?.length || 0} avatar styles
        </p>
        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back to Create Character
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Choose Your Child's Cartoon Style</h3>
        <p className="text-muted-foreground">
          Select the style you prefer for your child's character in the story
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {avatarStyles.map((avatar, index) => (
          <Card
            key={index}
            className={`relative overflow-hidden cursor-pointer transition-all ${
              selectedStyle?.style === avatar.style
                ? 'ring-2 ring-primary bg-primary/5'
                : 'hover:shadow-lg'
            }`}
            onClick={() => onStyleSelect(avatar)}
          >
            <div className="aspect-square w-full">
              <img
                src={avatar.imageUrl}
                alt={`${avatar.style} cartoon style`}
                className="w-full h-full object-cover"
              />
            </div>
            
            {selectedStyle?.style === avatar.style && (
              <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                <Check className="h-4 w-4" />
              </div>
            )}
            
            <div className="p-4">
              <h4 className="font-medium text-sm text-center">
                {avatar.style.replace('-style', '').replace(' cartoon', '')}
              </h4>
            </div>
          </Card>
        ))}
      </div>
      
      {selectedStyle && (
        <div className="text-center">
          <Button
            onClick={() => onStyleSelect(selectedStyle)}
            className="mt-4"
          >
            Continue with {selectedStyle.style.replace('-style', '').replace(' cartoon', '')} Style
          </Button>
        </div>
      )}
    </div>
  );
};