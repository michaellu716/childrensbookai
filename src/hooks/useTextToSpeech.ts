import { useState, useEffect, useRef } from 'react';

interface UseTextToSpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice | null;
  onSpeechEnd?: () => void;
}

interface UseTextToSpeechReturn {
  speak: (text: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isSupported: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  voices: SpeechSynthesisVoice[];
}

export const useTextToSpeech = (options: UseTextToSpeechOptions = {}): UseTextToSpeechReturn => {
  const {
    rate = 1,
    pitch = 1,
    volume = 1,
    voice = null,
    onSpeechEnd,
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);

      const loadVoices = () => {
        const availableVoices = speechSynthesis.getVoices();
        setVoices(availableVoices);
        
        // Try to find a more natural voice
        const preferredVoices = availableVoices.filter(voice => 
          voice.name.includes('Natural') || 
          voice.name.includes('Enhanced') ||
          voice.name.includes('Premium') ||
          voice.name.includes('Neural') ||
          (voice.lang.startsWith('en') && voice.localService === false) // Cloud voices are often better
        );
        
        if (preferredVoices.length > 0) {
          console.log('Found enhanced voices:', preferredVoices.map(v => v.name));
        }
      };

      loadVoices();
      speechSynthesis.onvoiceschanged = loadVoices;

      return () => {
        speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const speak = (text: string) => {
    if (!isSupported || !text.trim()) return;

    console.log('TTS: Starting to speak:', text.substring(0, 50) + '...');
    
    // Stop any current speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    // Try to select a better voice
    if (!voice && voices.length > 0) {
      const preferredVoice = voices.find(v => 
        v.name.includes('Natural') || 
        v.name.includes('Enhanced') ||
        v.name.includes('Premium') ||
        v.name.includes('Neural') ||
        (v.lang.startsWith('en') && v.localService === false)
      ) || voices.find(v => v.lang.startsWith('en-US')) || voices[0];
      
      if (preferredVoice) {
        console.log('Using voice:', preferredVoice.name);
        utterance.voice = preferredVoice;
      }
    } else if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      console.log('TTS: Speech started');
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      console.log('TTS: Speech ended');
      setIsPlaying(false);
      setIsPaused(false);
      utteranceRef.current = null;
      
      // Call the callback if provided
      if (onSpeechEnd) {
        onSpeechEnd();
      }
    };

    utterance.onerror = (event) => {
      console.log('TTS: Speech error:', event.error);
      setIsPlaying(false);
      setIsPaused(false);
      utteranceRef.current = null;
    };

    utterance.onpause = () => {
      console.log('TTS: Speech paused');
      setIsPaused(true);
    };

    utterance.onresume = () => {
      console.log('TTS: Speech resumed');
      setIsPaused(false);
    };

    speechSynthesis.speak(utterance);
  };

  const stop = () => {
    if (isSupported) {
      speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      utteranceRef.current = null;
    }
  };

  const pause = () => {
    if (isSupported && isPlaying) {
      speechSynthesis.pause();
    }
  };

  const resume = () => {
    if (isSupported && isPaused) {
      speechSynthesis.resume();
    }
  };

  return {
    speak,
    stop,
    pause,
    resume,
    isSupported,
    isPlaying,
    isPaused,
    voices,
  };
};