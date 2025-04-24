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
        
        // Calculate how many bytes of audio data we can store (each pixel can store 3 bytes in RGB)
        const maxBytes = Math.floor(totalPixels * 3 / 2); // Using every other pixel
        
        if (audioData.length > maxBytes) {
            throw new Error(`Audio file too large: can store ${maxBytes} bytes, but audio data is ${audioData.length} bytes`);
        }

        // Store the length of audio data in the first 4 pixels
        const lengthBytes = new Uint8Array(new Uint32Array([audioData.length]).buffer);
        for (let i = 0; i < 4; i++) {
            // RGB components of the first 4 pixels
            data[i * 8 + 0] = lengthBytes[i]; // R component of pixel i
            data[i * 8 + 1] = 0;              // G component of pixel i (unchanged)
            data[i * 8 + 2] = 0;              // B component of pixel i (unchanged)
            // Alpha is untouched
        }

        // Encode audio data into every other pixel's RGB values
        let audioByteIndex = 0;
        for (let i = 8; i < data.length - 4; i += 8) { // Start after the 4 length pixels, step by 8 (RGBA * 2 pixels)
            if (audioByteIndex >= audioData.length) break;
            
            // Only use RGB components (skip alpha)
            if (audioByteIndex < audioData.length) data[i + 0] = audioData[audioByteIndex++]; // R
            if (audioByteIndex < audioData.length) data[i + 1] = audioData[audioByteIndex++]; // G
            if (audioByteIndex < audioData.length) data[i + 2] = audioData[audioByteIndex++]; // B
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
        // Set canvas size to match image
        this.canvas.width = encodedImage.width;
        this.canvas.height = encodedImage.height;

        // Draw the encoded image on the canvas
        this.ctx.drawImage(encodedImage, 0, 0);

        // Get the image data
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        // Extract the length of audio data from the first 4 pixels
        const lengthBytes = new Uint8Array(4);
        for (let i = 0; i < 4; i++) {
            lengthBytes[i] = data[i * 8 + 0]; // R component of pixel i
        }
        const audioDataLength = new Uint32Array(lengthBytes.buffer)[0];

        // Extract the audio data
        const audioData = new Uint8Array(audioDataLength);
        let audioByteIndex = 0;
        
        for (let i = 8; i < data.length - 4 && audioByteIndex < audioDataLength; i += 8) {
            audioData[audioByteIndex++] = data[i + 0]; // R
            if (audioByteIndex < audioDataLength) audioData[audioByteIndex++] = data[i + 1]; // G
            if (audioByteIndex < audioDataLength) audioData[audioByteIndex++] = data[i + 2]; // B
        }

        return audioData;
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

