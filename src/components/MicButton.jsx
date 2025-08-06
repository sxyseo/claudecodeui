import React, { useState, useEffect, useRef } from 'react';
import { Mic, Loader2, Brain } from 'lucide-react';
import { transcribeWithWhisper } from '../utils/whisper';

// Simple audio compression by creating smaller chunks
const compressAudio = async (audioBlob, mimeType) => {
  // For now, just return the original blob
  // Real compression would require complex audio processing
  return audioBlob;
};

export function MicButton({ onTranscript, className = '' }) {
  const [state, setState] = useState('idle'); // idle, recording, transcribing, processing
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const lastTapRef = useRef(0);
  const recordingStartTime = useRef(null);
  const recordingTimer = useRef(null);
  
  // Constants for recording limits
  const MAX_RECORDING_TIME = 30000; // 30 seconds (shorter for smaller files)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (more conservative limit)
  
  // Check microphone support on mount
  useEffect(() => {
    const checkSupport = () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsSupported(false);
        setError('Microphone not supported. Please use HTTPS or a modern browser.');
        return;
      }
      
      // Additional check for secure context
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        setIsSupported(false);
        setError('Microphone requires HTTPS. Please use a secure connection.');
        return;
      }
      
      setIsSupported(true);
      setError(null);
    };
    
    checkSupport();
  }, []);

  // Start recording
  const startRecording = async () => {
    try {
      console.log('Starting recording...');
      setError(null);
      chunksRef.current = [];

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access not available. Please use HTTPS or a supported browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Use optimal audio settings for smaller file size
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';
        
      const recorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 32000 // Very low bitrate for small files (speech quality)
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        console.log('Recording stopped, creating blob...');
        
        // Clear recording timer
        if (recordingTimer.current) {
          clearInterval(recordingTimer.current);
          recordingTimer.current = null;
        }
        
        let blob = new Blob(chunksRef.current, { type: mimeType });
        
        // Check file size and compress if needed
        console.log(`Original audio file size: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
        
        // If file is too large, try to compress it
        if (blob.size > MAX_FILE_SIZE) {
          try {
            console.log('Attempting to compress audio...');
            blob = await compressAudio(blob, mimeType);
            console.log(`Compressed audio file size: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
            
            // Check again after compression
            if (blob.size > MAX_FILE_SIZE) {
              setError(`Recording still too large after compression (${(blob.size / 1024 / 1024).toFixed(1)}MB). Please record shorter audio.`);
              setState('idle');
              setTimeout(() => setError(null), 5000);
              
              // Clean up stream
              if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
              }
              return;
            }
          } catch (compressionError) {
            console.error('Audio compression failed:', compressionError);
            setError(`Recording too large (${(blob.size / 1024 / 1024).toFixed(1)}MB) and compression failed. Please record shorter audio.`);
            setState('idle');
            setTimeout(() => setError(null), 5000);
            
            // Clean up stream
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
              streamRef.current = null;
            }
            return;
          }
        }
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        // Reset recording duration
        setRecordingDuration(0);

        // Start transcribing
        setState('transcribing');
        
        // Check if we're in an enhancement mode
        const whisperMode = window.localStorage.getItem('whisperMode') || 'default';
        const isEnhancementMode = whisperMode === 'prompt' || whisperMode === 'vibe' || whisperMode === 'instructions' || whisperMode === 'architect';
        
        // Set up a timer to switch to processing state for enhancement modes
        let processingTimer;
        if (isEnhancementMode) {
          processingTimer = setTimeout(() => {
            setState('processing');
          }, 2000); // Switch to processing after 2 seconds
        }
        
        try {
          const text = await transcribeWithWhisper(blob);
          if (text && text.trim() && onTranscript) {
            onTranscript(text);
          } else if (!text || !text.trim()) {
            setError('No speech detected. Please try again.');
            // Auto-clear error after 3 seconds
            setTimeout(() => setError(null), 3000);
          }
        } catch (err) {
          console.error('Transcription error:', err);
          let errorMessage = 'Transcription failed';
          
          if (err.message.includes('MiniMax') && err.message.includes('OpenAI')) {
            errorMessage = 'Speech recognition services unavailable';
          } else if (err.message.includes('connect')) {
            errorMessage = 'Cannot connect to server';
          } else if (err.message.includes('key')) {
            errorMessage = 'Speech recognition not configured';
          } else {
            errorMessage = err.message;
          }
          
          setError(errorMessage);
          // Auto-clear error after 5 seconds
          setTimeout(() => setError(null), 5000);
        } finally {
          if (processingTimer) {
            clearTimeout(processingTimer);
          }
          setState('idle');
        }
      };

      recorder.start();
      setState('recording');
      
      // Start recording timer
      recordingStartTime.current = Date.now();
      setRecordingDuration(0);
      
      recordingTimer.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartTime.current;
        setRecordingDuration(elapsed);
        
        // Auto-stop recording after max time
        if (elapsed >= MAX_RECORDING_TIME) {
          console.log('Recording auto-stopped due to time limit');
          stopRecording();
        }
      }, 100); // Update every 100ms for smooth display
      
      console.log('Recording started successfully');
    } catch (err) {
      console.error('Failed to start recording:', err);
      
      // Provide specific error messages based on error type
      let errorMessage = 'Microphone access failed';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied. Please allow microphone permissions.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please check your audio devices.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 'Microphone not supported by this browser.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Microphone is being used by another application.';
      } else if (err.message.includes('HTTPS')) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setState('idle');
    }
  };

  // Stop recording
  const stopRecording = () => {
    console.log('Stopping recording...');
    
    // Clear recording timer
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      // Don't set state here - let the onstop handler do it
    } else {
      // If recorder isn't in recording state, force cleanup
      console.log('Recorder not in recording state, forcing cleanup');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setRecordingDuration(0);
      setState('idle');
    }
  };

  // Handle button click
  const handleClick = (e) => {
    // Prevent double firing on mobile
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Don't proceed if microphone is not supported
    if (!isSupported) {
      return;
    }
    
    // Debounce for mobile double-tap issue
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      console.log('Ignoring rapid tap');
      return;
    }
    lastTapRef.current = now;
    
    console.log('Button clicked, current state:', state);
    
    if (state === 'idle') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
    // Do nothing if transcribing or processing
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, []);

  // Button appearance based on state
  const getButtonAppearance = () => {
    if (!isSupported) {
      return {
        icon: <Mic className="w-5 h-5" />,
        className: 'bg-gray-400 cursor-not-allowed',
        disabled: true
      };
    }
    
    switch (state) {
      case 'recording':
        return {
          icon: <Mic className="w-5 h-5 text-white" />,
          className: 'bg-red-500 hover:bg-red-600 animate-pulse',
          disabled: false
        };
      case 'transcribing':
        return {
          icon: <Loader2 className="w-5 h-5 animate-spin" />,
          className: 'bg-blue-500 hover:bg-blue-600',
          disabled: true
        };
      case 'processing':
        return {
          icon: <Brain className="w-5 h-5 animate-pulse" />,
          className: 'bg-purple-500 hover:bg-purple-600',
          disabled: true
        };
      default: // idle
        return {
          icon: <Mic className="w-5 h-5" />,
          className: 'bg-gray-700 hover:bg-gray-600',
          disabled: false
        };
    }
  };

  const { icon, className: buttonClass, disabled } = getButtonAppearance();

  return (
    <div className="relative">
      <button
        type="button"
        style={{
          backgroundColor: state === 'recording' ? '#ef4444' : 
                          state === 'transcribing' ? '#3b82f6' : 
                          state === 'processing' ? '#a855f7' :
                          '#374151'
        }}
        className={`
          flex items-center justify-center
          w-12 h-12 rounded-full
          text-white transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          dark:ring-offset-gray-800
          touch-action-manipulation
          ${disabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}
          ${state === 'recording' ? 'animate-pulse' : ''}
          hover:opacity-90
          ${className}
        `}
        onClick={handleClick}
        disabled={disabled}
      >
        {icon}
      </button>
      
      {/* Recording duration display */}
      {state === 'recording' && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 
                        bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
          {Math.floor(recordingDuration / 1000)}s / {Math.floor(MAX_RECORDING_TIME / 1000)}s
        </div>
      )}
      
      {error && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 
                        bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10
                        animate-fade-in">
          {error}
        </div>
      )}
      
      {state === 'recording' && (
        <div className="absolute -inset-1 rounded-full border-2 border-red-500 animate-ping pointer-events-none" />
      )}
      
      {state === 'processing' && (
        <div className="absolute -inset-1 rounded-full border-2 border-purple-500 animate-ping pointer-events-none" />
      )}
    </div>
  );
}