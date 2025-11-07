const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

/**
 * Process image with threshold and contrast adjustments
 * @param {string} imagePath - Path to the input image file
 * @param {number} threshold - Black threshold value (0-255)
 * @param {number} redThreshold - Red threshold value (0-255)
 * @param {number} contrast - Contrast multiplier (0.1-5.0)
 * @param {number} maxWidth - Maximum width for resizing (default: 800)
 * @param {number} maxHeight - Maximum height for resizing (default: 480)
 * @returns {string} Base64 encoded processed image
 */
function processImage(imagePath, threshold = 128, redThreshold = 128, contrast = 1.0, maxWidth = 800, maxHeight = 480) {
    try {
        // Validate input parameters
        if (!fs.existsSync(imagePath)) {
            throw new Error(`Image file not found: ${imagePath}`);
        }
        
        if (threshold < 0 || threshold > 255) {
            throw new Error('Threshold must be between 0 and 255');
        }
        
        if (redThreshold < 0 || redThreshold > 255) {
            throw new Error('Red threshold must be between 0 and 255');
        }
        
        if (contrast < 0.1 || contrast > 5.0) {
            throw new Error('Contrast must be between 0.1 and 5.0');
        }
        
        if (threshold > redThreshold) {
            throw new Error('Black threshold cannot be greater than red threshold');
        }

        // Load image synchronously
        const img = loadImage(imagePath);
        
        // Calculate target dimensions
        let targetWidth = img.width;
        let targetHeight = img.height;
        
        if (img.width > maxWidth || img.height > maxHeight) {
            const widthRatio = maxWidth / img.width;
            const heightRatio = maxHeight / img.height;
            const scale = Math.min(widthRatio, heightRatio);
            targetWidth = Math.floor(img.width * scale);
            targetHeight = Math.floor(img.height * scale);
        }
        
        // Create canvas and context
        const canvas = createCanvas(targetWidth, targetHeight);
        const ctx = canvas.getContext('2d');
        
        // Draw and resize image
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imageData.data;
        
        // Convert to grayscale first
        const grayscaleData = new Uint8ClampedArray(data.length);
        for (let i = 0; i < data.length; i += 4) {
            // Standard grayscale conversion formula
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            grayscaleData[i] = gray;     // R
            grayscaleData[i + 1] = gray; // G
            grayscaleData[i + 2] = gray; // B
            grayscaleData[i + 3] = data[i + 3]; // A
        }
        
        // Apply contrast and threshold processing
        const processedData = ctx.createImageData(targetWidth, targetHeight);
        const processed = processedData.data;
        
        for (let i = 0; i < grayscaleData.length; i += 4) {
            const gray = grayscaleData[i];
            
            // Apply contrast adjustment (centered around 128)
            let adjusted = contrast * (gray - 128) + 128;
            adjusted = Math.min(255, Math.max(0, adjusted));
            
            // Apply three-color threshold logic
            if (adjusted <= threshold) {
                // Black
                processed[i] = 0;
                processed[i + 1] = 0;
                processed[i + 2] = 0;
            } else if (adjusted >= redThreshold) {
                // White
                processed[i] = 255;
                processed[i + 1] = 255;
                processed[i + 2] = 255;
            } else {
                // Red (middle range)
                processed[i] = 255;
                processed[i + 1] = 0;
                processed[i + 2] = 0;
            }
            
            // Preserve alpha channel
            processed[i + 3] = grayscaleData[i + 3];
        }
        
        // Put processed data back to canvas
        ctx.putImageData(processedData, 0, 0);
        
        // Convert to base64
        const base64 = canvas.toDataURL('image/png');
        
        return base64;
        
    } catch (error) {
        throw new Error(`Image processing failed: ${error.message}`);
    }
}

/**
 * Process image and save to file
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to save processed image
 * @param {number} threshold - Black threshold value
 * @param {number} redThreshold - Red threshold value
 * @param {number} contrast - Contrast multiplier
 */
function processAndSaveImage(inputPath, outputPath, threshold = 128, redThreshold = 128, contrast = 1.0) {
    try {
        const base64 = processImage(inputPath, threshold, redThreshold, contrast);
        
        // Remove data URL prefix and save as file
        const base64Data = base64.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(outputPath, base64Data, 'base64');
        
        console.log(`Processed image saved to: ${outputPath}`);
        return true;
    } catch (error) {
        console.error(`Failed to process and save image: ${error.message}`);
        return false;
    }
}

// Example usage
function example() {
    const imagePath = './input.jpg';
    const threshold = 100;
    const redThreshold = 180;
    const contrast = 1.5;
    
    try {
        // Get base64 result
        const base64Result = processImage(imagePath, threshold, redThreshold, contrast);
        console.log('Base64 length:', base64Result.length);
        console.log('Base64 preview:', base64Result.substring(0, 100) + '...');
        
        // Or save to file
        processAndSaveImage(imagePath, './output.png', threshold, redThreshold, contrast);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Export for use in other modules
module.exports = {
    processImage,
    processAndSaveImage
};

// Uncomment to run example
// example();