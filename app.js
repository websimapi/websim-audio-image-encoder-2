/**
 * Main application logic
 */
document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const audioUpload = document.getElementById('audio-upload');
    const audioPreview = document.getElementById('audio-preview');
    const imageDescription = document.getElementById('image-description');
    const aspectRatio = document.getElementById('aspect-ratio');
    const generateBtn = document.getElementById('generate-btn');
    const encodedImage = document.getElementById('encoded-image');
    const encodedImageUpload = document.getElementById('encoded-image-upload');
    const uploadedEncodedImage = document.getElementById('uploaded-encoded-image');
    const extractedAudio = document.getElementById('extracted-audio');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultControls = document.getElementById('result-controls');
    const extractedControls = document.getElementById('extracted-controls');
    const playEncodedAudioBtn = document.getElementById('play-encoded-audio');
    const downloadEncodedImageBtn = document.getElementById('download-encoded-image');
    const downloadExtractedAudioBtn = document.getElementById('download-extracted-audio');
    
    // Tab navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // State management
    let audioLoaded = false;
    let currentAudioFile = null;
    let currentEncodedCanvas = null;
    let decodedAudioBuffer = null;
    
    // Initialize UI
    initializeUI();
    
    /**
     * Initialize the UI and event listeners
     */
    function initializeUI() {
        // Tab navigation
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                
                // Update button states
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Show selected tab content
                tabContents.forEach(content => {
                    if (content.id === `${tabId}-tab`) {
                        content.classList.remove('hidden');
                    } else {
                        content.classList.add('hidden');
                    }
                });
            });
        });
        
        // Audio upload handling
        audioUpload.addEventListener('change', handleAudioUpload);
        
        // Image description input handling
        imageDescription.addEventListener('input', updateGenerateButtonState);
        
        // Generate button
        generateBtn.addEventListener('click', handleImageGeneration);
        
        // Play encoded audio
        playEncodedAudioBtn.addEventListener('click', playEncodedAudio);
        
        // Download encoded image
        downloadEncodedImageBtn.addEventListener('click', downloadEncodedImage);
        
        // Upload encoded image
        encodedImageUpload.addEventListener('change', handleEncodedImageUpload);
        
        // Download extracted audio
        downloadExtractedAudioBtn.addEventListener('click', downloadExtractedAudio);
    }
    
    /**
     * Handle audio file upload
     * @param {Event} event - The change event
     */
    async function handleAudioUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            currentAudioFile = file;
            
            // Set audio preview
            audioPreview.src = URL.createObjectURL(file);
            audioPreview.onloadedmetadata = () => {
                audioPreview.play();
            };
            
            // Process the audio file
            await audioHandler.loadAudioFile(file);
            audioLoaded = true;
            
            // Update UI
            updateGenerateButtonState();
            
        } catch (error) {
            console.error('Error loading audio:', error);
            alert('Failed to load audio file. Please try another file.');
        }
    }
    
    /**
     * Update the generate button state based on inputs
     */
    function updateGenerateButtonState() {
        generateBtn.disabled = !audioLoaded || !imageDescription.value.trim();
    }
    
    /**
     * Handle image generation and audio encoding
     */
    async function handleImageGeneration() {
        if (!audioLoaded || !audioHandler.audioData) {
            alert('Please upload an audio file first.');
            return;
        }
        
        const description = imageDescription.value.trim();
        if (!description) {
            alert('Please enter an image description.');
            return;
        }
        
        try {
            // Show loading indicator
            loadingIndicator.classList.remove('hidden');
            generateBtn.disabled = true;
            
            // Generate image with AI
            const imageUrl = await imageGenerator.generateImage(description, aspectRatio.value);
            const image = await imageGenerator.loadImage(imageUrl);
            
            // Encode audio into the image
            currentEncodedCanvas = encoder.encodeAudioIntoImage(image, audioHandler.audioData);
            
            // Display the encoded image
            encodedImage.src = currentEncodedCanvas.toDataURL('image/png');
            encodedImage.classList.remove('hidden');
            
            // Show controls
            resultControls.classList.remove('hidden');
            
            // Hide loading indicator
            loadingIndicator.classList.add('hidden');
            
        } catch (error) {
            console.error('Error during image generation or encoding:', error);
            alert('An error occurred: ' + error.message);
            loadingIndicator.classList.add('hidden');
            generateBtn.disabled = false;
        }
    }
    
    /**
     * Play the audio encoded in the image
     */
    async function playEncodedAudio() {
        try {
            if (!currentEncodedCanvas) {
                alert('No encoded image available.');
                return;
            }
            
            // Create an image from the canvas
            const img = new Image();
            img.src = currentEncodedCanvas.toDataURL('image/png');
            
            // Wait for image to load
            await new Promise(resolve => { img.onload = resolve; });
            
            // Decode audio from the image
            const decodedData = encoder.decodeAudioFromImage(img);
            
            // Create audio from decoded data
            const result = audioHandler.createAudioFromDecodedData(decodedData);
            
            // Play the audio
            await audioHandler.playAudioBuffer(result.audioBuffer);
            
        } catch (error) {
            console.error('Error playing encoded audio:', error);
            alert('Failed to play encoded audio: ' + error.message);
        }
    }
    
    /**
     * Download the encoded image
     */
    async function downloadEncodedImage() {
        if (!currentEncodedCanvas) {
            alert('No encoded image available.');
            return;
        }
        
        try {
            // Get audio filename without extension for the new filename
            let baseFilename = 'encoded-image';
            if (currentAudioFile) {
                const name = currentAudioFile.name;
                baseFilename = name.substring(0, name.lastIndexOf('.')) || name;
            }
            
            const downloadInfo = await encoder.createDownloadableImage(
                currentEncodedCanvas, 
                `${baseFilename}-encoded.png`
            );
            
            // Create and trigger download
            const a = document.createElement('a');
            a.href = downloadInfo.url;
            a.download = downloadInfo.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up
            setTimeout(() => URL.revokeObjectURL(downloadInfo.url), 100);
            
        } catch (error) {
            console.error('Error creating downloadable image:', error);
            alert('Failed to prepare image for download: ' + error.message);
        }
    }
    
    /**
     * Handle encoded image upload for decoding
     */
    async function handleEncodedImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            // Load the encoded image
            const img = await imageGenerator.loadImageFromFile(file);
            
            // Display the image
            uploadedEncodedImage.src = URL.createObjectURL(file);
            uploadedEncodedImage.classList.remove('hidden');
            
            // Decode audio from the image
            const decodedData = encoder.decodeAudioFromImage(img);
            
            // Create audio from decoded data
            const result = audioHandler.createAudioFromDecodedData(decodedData);
            decodedAudioBuffer = result.audioBuffer;
            
            // Update the audio element
            const audioBlob = audioHandler.audioBufferToWav(result.audioBuffer);
            extractedAudio.src = URL.createObjectURL(audioBlob);
            
            // Show download button
            extractedControls.classList.remove('hidden');
            
        } catch (error) {
            console.error('Error decoding audio from image:', error);
            alert('Failed to decode audio from image: ' + error.message);
        }
    }
    
    /**
     * Download the extracted audio
     */
    async function downloadExtractedAudio() {
        if (!decodedAudioBuffer) {
            alert('No decoded audio available.');
            return;
        }
        
        try {
            // Create downloadable audio
            const downloadInfo = audioHandler.createDownloadableAudio(
                decodedAudioBuffer, 
                'extracted-audio.wav'
            );
            
            // Create and trigger download
            const a = document.createElement('a');
            a.href = downloadInfo.url;
            a.download = downloadInfo.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up
            setTimeout(() => URL.revokeObjectURL(downloadInfo.url), 100);
            
        } catch (error) {
            console.error('Error creating downloadable audio:', error);
            alert('Failed to prepare audio for download: ' + error.message);
        }
    }
});

