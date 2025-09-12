import { BookOpen } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t border-border/10 bg-background/80 backdrop-blur-sm py-8 mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="flex items-center space-x-3 group">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg group-hover:scale-110 transition-transform duration-300">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              StoryBook AI
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2025 StoryBook AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};