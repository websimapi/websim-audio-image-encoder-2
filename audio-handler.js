/**
 * AudioHandler manages audio file loading, processing, and playback
 */
class AudioHandler {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.audioData = null;
        this.sampleRate = 0;
        this.audioFileName = '';
    }

    /**
     * Initialize the audio context
     */
    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    /**
     * Load an audio file and convert to a format that can be encoded
     * @param {File} file - The audio file to load
     * @returns {Promise} - Resolves when audio is processed
     */
    async loadAudioFile(file) {
        this.initAudioContext();
        this.audioFileName = file.name;
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                    this.sampleRate = this.audioBuffer.sampleRate;
                    
                    // Convert to a format that can be encoded in image
                    this.audioData = this.prepareAudioDataForEncoding();
                    
                    resolve({
                        duration: this.audioBuffer.duration,
                        sampleRate: this.sampleRate,
                        channels: this.audioBuffer.numberOfChannels,
                        dataLength: this.audioData.length
                    });
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read audio file'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Prepare audio data for encoding into an image
     * @returns {Uint8Array} - Audio data ready for encoding
     */
    prepareAudioDataForEncoding() {
        // Get first channel data (mono or left channel)
        const channelData = this.audioBuffer.getChannelData(0);
        
        // Convert Float32Array to Uint8Array for easier encoding
        // Scale from -1.0...1.0 to 0...255
        const samples = new Uint8Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
            samples[i] = Math.floor((channelData[i] + 1) * 127.5);
        }
        
        // Create header with metadata
        const metadataStr = JSON.stringify({
            sampleRate: this.sampleRate,
            channels: this.audioBuffer.numberOfChannels,
            filename: this.audioFileName,
            format: 'audio/wav'
        });
        
        // Convert metadata to bytes
        const encoder = new TextEncoder();
        const metadataBytes = encoder.encode(metadataStr);
        
        // Create a header with the metadata length (4 bytes) and the metadata
        const headerSize = new Uint32Array([metadataBytes.length]);
        const headerView = new Uint8Array(headerSize.buffer);
        
        // Combine everything into one array
        const result = new Uint8Array(headerView.length + metadataBytes.length + samples.length);
        result.set(headerView, 0);
        result.set(metadataBytes, headerView.length);
        result.set(samples, headerView.length + metadataBytes.length);
        
        return result;
    }

    /**
     * Create an audio buffer from decoded audio data
     * @param {Uint8Array} audioData - The decoded audio data from an image
     * @returns {Object} - Audio metadata and playable buffer
     */
    createAudioFromDecodedData(audioData) {
        // Extract header size (first 4 bytes)
        const headerSizeView = new Uint32Array(audioData.buffer.slice(0, 4));
        const metadataLength = headerSizeView[0];
        
        // Extract metadata
        const metadataBytes = audioData.slice(4, 4 + metadataLength);
        const decoder = new TextDecoder();
        const metadataStr = decoder.decode(metadataBytes);
        const metadata = JSON.parse(metadataStr);
        
        // Extract audio samples
        const samples = audioData.slice(4 + metadataLength);
        
        // Convert samples back to float32 for web audio
        const floatSamples = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            floatSamples[i] = (samples[i] / 127.5) - 1;
        }
        
        // Create audio buffer
        this.initAudioContext();
        const audioBuffer = this.audioContext.createBuffer(
            metadata.channels, 
            floatSamples.length, 
            metadata.sampleRate
        );
        
        // Fill the buffer
        const channelData = audioBuffer.getChannelData(0);
        channelData.set(floatSamples);
        
        return {
            metadata,
            audioBuffer
        };
    }

    /**
     * Play the decoded audio buffer
     * @param {AudioBuffer} audioBuffer - The audio buffer to play
     * @returns {Promise} - Resolves when playback ends
     */
    playAudioBuffer(audioBuffer) {
        return new Promise((resolve) => {
            this.initAudioContext();
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.onended = resolve;
            source.start();
        });
    }

    /**
     * Create a downloadable audio blob from an audio buffer
     * @param {AudioBuffer} audioBuffer - The audio buffer to convert
     * @param {String} filename - Suggested filename
     * @returns {Object} - Object with URL and filename
     */
    createDownloadableAudio(audioBuffer, filename) {
        // Convert AudioBuffer to WAV format
        const wavBlob = this.audioBufferToWav(audioBuffer);
        
        // Create download URL
        const url = URL.createObjectURL(wavBlob);
        
        return {
            url,
            filename: filename || 'decoded-audio.wav',
            type: 'audio/wav'
        };
    }

    /**
     * Convert an AudioBuffer to WAV format
     * @param {AudioBuffer} audioBuffer - The audio buffer to convert
     * @returns {Blob} - WAV file as a Blob
     */
    audioBufferToWav(audioBuffer) {
        const numOfChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length * numOfChannels * 2; // 2 bytes per sample
        const sampleRate = audioBuffer.sampleRate;
        const buffer = new ArrayBuffer(44 + length);
        const view = new DataView(buffer);
        
        // Write WAV header
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + length, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, numOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numOfChannels * 2, true); // Byte rate
        view.setUint16(32, numOfChannels * 2, true); // Block align
        view.setUint16(34, 16, true); // Bits per sample
        writeString(view, 36, 'data');
        view.setUint32(40, length, true);
        
        // Write audio data
        const channelData = [];
        let offset = 44;
        
        // Get data from all channels
        for (let i = 0; i < numOfChannels; i++) {
            channelData.push(audioBuffer.getChannelData(i));
        }
        
        // Interleave channel data and convert to 16-bit samples
        for (let i = 0; i < audioBuffer.length; i++) {
            for (let channel = 0; channel < numOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
        
        // Helper function to write strings to DataView
        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }
    }
}

// Create global instance
const audioHandler = new AudioHandler();

