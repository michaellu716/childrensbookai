import React, { useState, useRef } from 'react';
import { Upload, X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface PhotoUploadProps {
  onPhotoSelected: (file: File, preview: string) => void;
  selectedPhoto?: string;
  onRemovePhoto: () => void;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  onPhotoSelected,
  selectedPhoto,
  onRemovePhoto
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        onPhotoSelected(file, e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  if (selectedPhoto) {
    return (
      <Card className="relative overflow-hidden">
        <div className="aspect-square w-full">
          <img
            src={selectedPhoto}
            alt="Uploaded child photo"
            className="w-full h-full object-cover"
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-2 right-2"
          onClick={onRemovePhoto}
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <p className="text-white text-sm">
            Photo uploaded successfully! We'll create a cartoon character from this.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`relative border-2 border-dashed transition-colors ${
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50'
      }`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={() => setIsDragging(true)}
      onDragLeave={() => setIsDragging(false)}
    >
      <div className="aspect-square w-full flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-4">
          <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <Upload className="h-8 w-8 text-primary mx-auto" />
        </div>
        
        <h3 className="text-lg font-semibold mb-2">Upload Child's Photo</h3>
        <p className="text-sm text-muted-foreground mb-4">
          We'll create a cartoon character based on this photo that appears throughout the story
        </p>
        
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="mb-2"
        >
          Choose Photo
        </Button>
        
        <p className="text-xs text-muted-foreground">
          or drag and drop an image here
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />
        
        <div className="mt-4 text-xs text-muted-foreground">
          <p>• JPG, PNG, or WebP format</p>
          <p>• Clear headshot works best</p>
          <p>• Photo will be deleted after character creation</p>
        </div>
      </div>
    </Card>
  );
};