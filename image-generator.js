/**
 * ImageGenerator handles generating images based on user descriptions using AI
 */
class ImageGenerator {
    constructor() {
        // Configure default options
        this.defaultOptions = {
            size: "1024x1024", // Default size
            aspectRatio: "1:1" // Default aspect ratio
        };
    }

    /**
     * Generate an image based on a text description
     * @param {String} description - Text description of the image to generate
     * @param {String} aspectRatio - Aspect ratio for the image (e.g., "1:1", "16:9")
     * @returns {Promise<String>} - Promise resolving to the image URL
     */
    async generateImage(description, aspectRatio = "1:1") {
        try {
            const result = await websim.imageGen({
                prompt: description,
                aspect_ratio: aspectRatio
            });

            return result.url;
        } catch (error) {
            console.error("Error generating image:", error);
            throw new Error("Failed to generate image: " + error.message);
        }
    }

    /**
     * Load an image from a URL and return as an Image element
     * @param {String} url - URL of the image to load
     * @returns {Promise<HTMLImageElement>} - Promise resolving to the loaded image
     */
    loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // Enable CORS for canvas operations
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = url;
        });
    }

    /**
     * Load an image from a File object
     * @param {File} file - Image file to load
     * @returns {Promise<HTMLImageElement>} - Promise resolving to the loaded image
     */
    loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error("Failed to load image"));
                img.src = e.target.result;
            };
            
            reader.onerror = () => reject(new Error("Failed to read image file"));
            reader.readAsDataURL(file);
        });
    }
}

// Create global instance
const imageGenerator = new ImageGenerator();

