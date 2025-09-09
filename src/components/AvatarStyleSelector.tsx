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
  selectedStyle?: AvatarStyle | null;
  onStyleSelect: (style: AvatarStyle) => void;
  isLoading?: boolean;
  onBack?: () => void;
  onSkip?: () => void;
  onRetry?: () => void;
}

export const AvatarStyleSelector: React.FC<AvatarStyleSelectorProps> = ({
  avatarStyles,
  selectedStyle,
  onStyleSelect,
  isLoading = false,
  onBack,
  onSkip,
  onRetry,
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
      <Card className="p-6 text-center max-w-2xl mx-auto">
        <h3 className="text-lg font-semibold mb-3">Choose Your Child's Cartoon Style</h3>
        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
          Unable to generate cartoon styles from the photo. This might be due to API limits or processing issues.
        </p>
        <div className="flex flex-col gap-3 max-w-md mx-auto">
          <Button variant="outline" onClick={onBack} className="w-full">
            Upload Different Photo
          </Button>
          <Button variant="secondary" onClick={onRetry} className="w-full">
            Try Again
          </Button>
          <Button onClick={onSkip} className="w-full">
            Continue Without Photo
          </Button>
        </div>
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