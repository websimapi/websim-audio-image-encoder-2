/**
 * Encoder handles encoding audio data into images and decoding audio from images
 */
class Encoder {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        // Define header size (in pixels)
        this.HEADER_PIXELS = 10; // First 10 pixels used for header
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

        // Calculate how many pixels we have available for audio data
        const totalPixels = this.canvas.width * this.canvas.height;
        const availablePixels = totalPixels - this.HEADER_PIXELS;
        
        // Calculate optimal data distribution
        // Each pixel can store 3 bytes (R,G,B channels)
        const totalDataCapacity = availablePixels * 3; 
        const spreadFactor = Math.floor(totalDataCapacity / audioData.length);
        
        // Ensure we have enough capacity
        if (spreadFactor < 1) {
            throw new Error(`Audio file too large: can store ${totalDataCapacity} bytes, but audio data is ${audioData.length} bytes`);
        }
        
        // Create header data - RGBA format (we'll use RGB channels, leave A unchanged)
        // Structure:
        // Pixel 0: Magic number "EAI" (Encoded Audio Image) [69, 65, 73]
        // Pixel 1: Format version [1, 0, 0]
        // Pixel 2-3: Audio data length (4 bytes - 2 pixels, 2 bytes each) 
        // Pixel 4: Spread factor [spreadFactor, 0, 0]
        // Pixel 5-9: Reserved for future use
        
        // Pixel 0: Magic number
        data[0] = 69; // 'E'
        data[1] = 65; // 'A'
        data[2] = 73; // 'I'
        
        // Pixel 1: Version
        data[4] = 1;  // Major version
        data[5] = 0;  // Minor version
        data[6] = 0;  // Patch version
        
        // Pixel 2-3: Audio data length (32-bit value)
        const lengthBytes = new Uint8Array(4);
        new DataView(lengthBytes.buffer).setUint32(0, audioData.length, true);
        data[8] = lengthBytes[0];   // Length byte 0
        data[9] = lengthBytes[1];   // Length byte 1
        data[10] = lengthBytes[2];  // Length byte 2
        data[12] = lengthBytes[3];  // Length byte 3
        
        // Pixel 4: Spread factor
        data[16] = spreadFactor;
        data[17] = 0; // Reserved
        data[18] = 0; // Reserved
        
        // Pixels 5-9: Reserved for future use
        // We keep these unchanged for now
        
        // Encode audio data - start after header section
        // We'll distribute bytes evenly based on the spread factor
        let audioByteIndex = 0;
        let pixelStart = this.HEADER_PIXELS * 4; // Skip header pixels * 4 (RGBA)
        
        while (audioByteIndex < audioData.length && pixelStart < data.length) {
            // Store byte in R channel
            data[pixelStart] = audioData[audioByteIndex++];
            
            // If we have more audio data, store in G channel
            if (audioByteIndex < audioData.length) {
                data[pixelStart + 1] = audioData[audioByteIndex++];
            }
            
            // If we have more audio data, store in B channel
            if (audioByteIndex < audioData.length) {
                data[pixelStart + 2] = audioData[audioByteIndex++];
            }
            
            // Move to next pixel position based on spread factor
            pixelStart += 4 * spreadFactor; // Move ahead by spreadFactor pixels
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
    
            // Read header from first pixels
            // Check magic number
            if (!(data[0] === 69 && data[1] === 65 && data[2] === 73)) {
                throw new Error("Invalid encoded image: Missing magic number");
            }
            
            // Read version
            const version = {
                major: data[4],
                minor: data[5],
                patch: data[6]
            };
            
            // Check version compatibility
            if (version.major > 1) {
                throw new Error(`Unsupported encoding version: ${version.major}.${version.minor}.${version.patch}`);
            }
            
            // Read audio data length
            const lengthBytes = new Uint8Array(4);
            lengthBytes[0] = data[8];
            lengthBytes[1] = data[9];
            lengthBytes[2] = data[10];
            lengthBytes[3] = data[12];
            
            const audioDataLength = new DataView(lengthBytes.buffer).getUint32(0, true);
            
            // Read spread factor
            const spreadFactor = data[16];
            
            // Validate the data
            if (audioDataLength <= 0 || audioDataLength > 100000000) { // 100MB sanity check
                throw new Error("Invalid audio data length in header");
            }
            
            if (spreadFactor <= 0 || spreadFactor > 1000) { // Sanity check
                throw new Error("Invalid spread factor in header");
            }
    
            // Extract the audio data
            const audioData = new Uint8Array(audioDataLength);
            let audioByteIndex = 0;
            
            // Start after header
            let pixelStart = this.HEADER_PIXELS * 4; // Skip header pixels
            
            while (audioByteIndex < audioDataLength && pixelStart < data.length) {
                // Extract from R channel
                audioData[audioByteIndex++] = data[pixelStart];
                
                // Extract from G channel if needed
                if (audioByteIndex < audioDataLength) {
                    audioData[audioByteIndex++] = data[pixelStart + 1];
                }
                
                // Extract from B channel if needed
                if (audioByteIndex < audioDataLength) {
                    audioData[audioByteIndex++] = data[pixelStart + 2];
                }
                
                // Move to next pixel with spread factor
                pixelStart += 4 * spreadFactor;
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