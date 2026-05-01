import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { autocompletePlaces, getPlaceDetails, PlaceDetails } from '../lib/mapUtils';

interface AutocompleteInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (details: PlaceDetails) => void;
  onPreview?: (details: PlaceDetails | null) => void;
  className?: string;
  icon?: React.ReactNode;
  iconClassName?: string;
}

export default function AutocompleteInput({
  placeholder,
  value,
  onChange,
  onPlaceSelected,
  onPreview,
  className,
  icon,
  iconClassName
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.length < 3) {
        setSuggestions([]);
        return;
      }

      if (!sessionTokenRef.current && window.google?.maps?.places) {
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      }

      setIsLoading(true);
      try {
        const predictions = await autocompletePlaces(value, sessionTokenRef.current);
        setSuggestions(predictions);
        setShowSuggestions(true);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [value]);

  const handleSuggestionMouseEnter = async (suggestion: google.maps.places.AutocompletePrediction) => {
    if (!onPreview) return;
    
    try {
      const details = await getPlaceDetails(suggestion.place_id, sessionTokenRef.current);
      if (details) {
        onPreview(details);
      }
    } catch (e) {
      console.error('Preview error:', e);
    }
  };

  const handleSuggestionClick = async (suggestion: google.maps.places.AutocompletePrediction) => {
    onChange(suggestion.description);
    setShowSuggestions(false);
    
    setIsLoading(true);
    try {
      const details = await getPlaceDetails(suggestion.place_id, sessionTokenRef.current);
      if (details) {
        onPlaceSelected(details);
        // Reset session token after a successful selection
        sessionTokenRef.current = undefined;
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative group">
        {icon && (
          <div className={`absolute left-5 top-5 z-10 group-hover:scale-110 transition-transform ${iconClassName}`}>
            {icon}
          </div>
        )}
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => value.length >= 3 && setShowSuggestions(true)}
          className={className}
        />
        {isLoading && (
          <div className="absolute right-14 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onMouseLeave={() => onPreview?.(null)}
            className="absolute z-[60] left-0 right-0 mt-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl border border-white/20 dark:border-zinc-700/50 shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
          >
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.place_id}
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => handleSuggestionMouseEnter(suggestion)}
                className="w-full text-left p-4 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors flex items-start gap-3 border-b border-gray-100 dark:border-zinc-800 last:border-0"
              >
                <div className="mt-1 flex-shrink-0">
                  <MapPin className="w-4 h-4 text-gray-400 group-hover:text-purple-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {suggestion.structured_formatting.main_text}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                    {suggestion.structured_formatting.secondary_text}
                  </p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
