import { api } from './api';

export async function transcribeWithWhisper(audioBlob, onStatusChange) {
    console.log('🎵 Preparing audio transcription request...');
    console.log('📄 Audio blob:', {
      size: audioBlob.size,
      type: audioBlob.type
    });
    
    const formData = new FormData();
    const fileName = `recording_${Date.now()}.webm`;
    const file = new File([audioBlob], fileName, { type: audioBlob.type });
    
    console.log('📁 Created file:', {
      name: fileName,
      size: file.size,
      type: file.type
    });
    
    formData.append('audio', file);
    
    const whisperMode = window.localStorage.getItem('whisperMode') || 'default';
    formData.append('mode', whisperMode);
    
    console.log('📦 FormData prepared with mode:', whisperMode);
  
    try {
      // Start with transcribing state
      if (onStatusChange) {
        onStatusChange('transcribing');
      }
  
      console.log('🚀 Sending transcription request...');
      const response = await api.transcribe(formData);
      
      console.log('📡 Response status:', response.status, response.statusText);
  
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('❌ Error response text:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || `HTTP ${response.status}` };
        }
        
        // Handle specific error cases
        if (response.status === 500 && errorData.error) {
          if (errorData.error.includes('MiniMax API key not configured')) {
            throw new Error('Speech recognition not configured. Please add your API keys.');
          }
          if (errorData.error.includes('Both MiniMax and OpenAI')) {
            throw new Error('Speech recognition services unavailable. Please check API keys.');
          }
        }
        
        throw new Error(
          errorData.error || 
          `Transcription error: ${response.status} ${response.statusText}`
        );
      }
  
      const data = await response.json();
      const text = data.text || '';
      
      if (!text.trim()) {
        throw new Error('No speech detected. Please speak more clearly and try again.');
      }
      
      return text;
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Cannot connect to server. Please ensure the backend is running.');
      }
      throw error;
    }
  }