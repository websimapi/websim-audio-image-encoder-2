/**
 * Encoder handles encoding audio data into images and decoding audio from images
 */
class Encoder {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * Encode audio data into an image
     * @param {HTMLImageElement} image - The base image to encode data into
     * @param {Uint8Array} audioData - Audio data to encode
     * @returns {HTMLCanvasElement} - Canvas with the encoded image
     */
    encodeAudioIntoImage(image, audioData) {
        // Set canvas size to match image
        this.canvas.width = image.width;
        this.canvas.height = image.height;

        // Draw the original image on the canvas
        this.ctx.drawImage(image, 0, 0);

        // Get the image data
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        // Calculate how many pixels we have available
        const totalPixels = this.canvas.width * this.canvas.height;
        
        // Calculate optimal pixel skip rate based on audio data size
        // The larger the audio data relative to the image, the smaller the skip rate
        const audioToImageRatio = audioData.length / (totalPixels * 3);
        
        // Calculate skip rate: more spread out for smaller files, tighter for larger files
        // Minimum skip is 1 (use every pixel), max is 20 (use 1 in every 20 pixels)
        const skipRate = Math.max(1, Math.min(20, Math.floor(1 / audioToImageRatio) || 1));
        
        // Calculate max bytes we can store with this skip rate
        const maxBytes = Math.floor(totalPixels * 3 / skipRate);
        
        if (audioData.length > maxBytes) {
            throw new Error(`Audio file too large: can store ${maxBytes} bytes, but audio data is ${audioData.length} bytes`);
        }

        // Define metadata structure
        const metadata = {
            skipRate: skipRate,
            audioLength: audioData.length,
            startOffset: 32 // Where the actual audio data begins in pixels
        };
        
        // Convert metadata to bytes (32 bytes reserved for metadata)
        const metadataBuffer = new ArrayBuffer(32);
        const metadataView = new DataView(metadataBuffer);
        
        // Store metadata in first 32 bytes
        metadataView.setUint32(0, metadata.skipRate, true);     // 0-3: Skip rate
        metadataView.setUint32(4, metadata.audioLength, true);  // 4-7: Audio data length
        metadataView.setUint32(8, metadata.startOffset, true);  // 8-11: Start offset
        // 12-31: Reserved for future use
        
        // Write metadata to image
        const metadataBytes = new Uint8Array(metadataBuffer);
        for (let i = 0; i < metadataBytes.length; i++) {
            // Each byte goes to one color channel, cycling through R,G,B
            const pixelIndex = Math.floor(i / 3) * 4; // *4 because RGBA
            const channelOffset = i % 3;              // 0=R, 1=G, 2=B
            data[pixelIndex + channelOffset] = metadataBytes[i];
        }

        // Encode audio data into pixels using the calculated skip rate
        let audioByteIndex = 0;
        const startPixel = metadata.startOffset;
        
        // We'll use all three color channels (R,G,B) of selected pixels
        for (let pixelIndex = startPixel * 4; pixelIndex < data.length - 4; pixelIndex += (skipRate * 4)) {
            if (audioByteIndex >= audioData.length) break;
            
            // Use RGB components (skip alpha)
            if (audioByteIndex < audioData.length) data[pixelIndex + 0] = audioData[audioByteIndex++]; // R
            if (audioByteIndex < audioData.length) data[pixelIndex + 1] = audioData[audioByteIndex++]; // G
            if (audioByteIndex < audioData.length) data[pixelIndex + 2] = audioData[audioByteIndex++]; // B
            // Alpha is untouched
        }

        // Put the modified image data back to the canvas
        this.ctx.putImageData(imageData, 0, 0);
        
        return this.canvas;
    }

    /**
     * Decode audio data from an encoded image
     * @param {HTMLImageElement} encodedImage - The image with encoded audio data
     * @returns {Uint8Array} - The decoded audio data
     */
    decodeAudioFromImage(encodedImage) {
        try {
            // Set canvas size to match image
            this.canvas.width = encodedImage.width;
            this.canvas.height = encodedImage.height;
    
            // Draw the encoded image on the canvas
            this.ctx.drawImage(encodedImage, 0, 0);
    
            // Get the image data
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const data = imageData.data;
    
            // Read metadata from first 32 bytes (first ~11 pixels)
            const metadataBuffer = new ArrayBuffer(32);
            const metadataBytes = new Uint8Array(metadataBuffer);
            
            for (let i = 0; i < metadataBytes.length; i++) {
                const pixelIndex = Math.floor(i / 3) * 4; // *4 because RGBA
                const channelOffset = i % 3;              // 0=R, 1=G, 2=B
                metadataBytes[i] = data[pixelIndex + channelOffset];
            }
            
            const metadataView = new DataView(metadataBuffer);
            const skipRate = metadataView.getUint32(0, true);
            const audioDataLength = metadataView.getUint32(4, true);
            const startOffset = metadataView.getUint32(8, true);
            
            // Validate the metadata to avoid buffer allocation issues
            if (audioDataLength <= 0 || audioDataLength > 100000000) { // 100MB limit as sanity check
                throw new Error("Invalid audio data length in metadata");
            }
            
            if (skipRate <= 0 || skipRate > 100) { // Sanity check for skip rate
                throw new Error("Invalid skip rate in metadata");
            }
    
            // Extract the audio data in smaller chunks to avoid memory issues
            const audioData = new Uint8Array(audioDataLength);
            let audioByteIndex = 0;
            
            // Start at the specified offset and apply the skip rate
            for (let pixelIndex = startOffset * 4; 
                pixelIndex < data.length - 4 && audioByteIndex < audioDataLength; 
                pixelIndex += (skipRate * 4)) {
                
                // Extract from RGB channels
                audioData[audioByteIndex++] = data[pixelIndex + 0]; // R
                if (audioByteIndex < audioDataLength) audioData[audioByteIndex++] = data[pixelIndex + 1]; // G
                if (audioByteIndex < audioDataLength) audioData[audioByteIndex++] = data[pixelIndex + 2]; // B
            }
    
            return audioData;
        } catch (error) {
            console.error("Error decoding audio from image:", error);
            throw new Error("Failed to decode audio: " + error.message);
        }
    }

    /**
     * Create a downloadable blob from a canvas
     * @param {HTMLCanvasElement} canvas - The canvas element
     * @param {String} filename - Suggested filename
     * @returns {Object} - Object with URL and filename
     */
    createDownloadableImage(canvas, filename = 'encoded-image.png') {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                resolve({
                    url,
                    filename,
                    type: 'image/png'
                });
            }, 'image/png');
        });
    }
}

// Create global instance
const encoder = new Encoder();