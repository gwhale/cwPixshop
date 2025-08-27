/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, GeneratedImage} from '@google/genai';

// Initialize the Google AI client with the API key from environment variables.
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

// --- DOM Element References ---
const promptForm = document.getElementById('prompt-form') as HTMLFormElement;
const promptInput = document.getElementById('prompt-input') as HTMLInputElement;
const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const loadingIndicator = document.getElementById('loading-indicator') as HTMLDivElement;
const imageGallery = document.getElementById('text-image-gallery') as HTMLDivElement;

// --- App State Management ---
function setLoading(isLoading: boolean) {
    if (isLoading) {
        loadingIndicator.classList.remove('hidden');
        generateButton.disabled = true;
    } else {
        loadingIndicator.classList.add('hidden');
        generateButton.disabled = false;
    }
}

function displayError(message: string) {
    imageGallery.textContent = '';
    const errorParagraph = document.createElement('p');
    errorParagraph.textContent = message;
    errorParagraph.style.color = '#ff8a80'; // A lighter red for dark theme
    imageGallery.appendChild(errorParagraph);
}

// --- Image Generation Logic ---
async function generateImages(prompt: string) {
    if (!prompt) {
        displayError('Please enter a prompt.');
        return;
    }

    setLoading(true);
    imageGallery.textContent = ''; // Clear previous results

    try {
        const selectedModel = 'imagen-4.0-generate-001';

        // FIX: The parameters `numberOfImages`, `aspectRatio`, and `outputMimeType` must be nested inside a `config` object.
        const response = await ai.models.generateImages({
            model: selectedModel,
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: '1:1',
                outputMimeType: 'image/jpeg',
            },
        });

        // --- Render Generated Images ---
        if (imageGallery && response?.generatedImages) {
            response.generatedImages.forEach((generatedImage: GeneratedImage, index: number) => {
                if (generatedImage.image?.imageBytes) {
                    const src = `data:image/jpeg;base64,${generatedImage.image.imageBytes}`;
                    const img = new Image();
                    img.src = src;
                    img.alt = `${prompt} - Image ${Number(index) + 1}`;
                    imageGallery.appendChild(img);
                }
            });
        }

        // --- Log Metadata ---
        console.log('Full response:', response);
        if (response?.generatedImages) {
            console.log(`Number of generated images: ${response.generatedImages.length}`);
            response.generatedImages.forEach((generatedImage: GeneratedImage, index: number) => {
                console.log(`--- Image ${Number(index) + 1} ---`);
                if (generatedImage.image?.mimeType) {
                    console.log(`MIME Type: ${generatedImage.image.mimeType}`);
                }
                if (generatedImage.raiFilteredReason) {
                    console.log(`RAI Filtered Reason: ${generatedImage.raiFilteredReason}`);
                }
                if (generatedImage.safetyAttributes) {
                    console.log('Safety Attributes:', generatedImage.safetyAttributes);
                }
            });
        }

    } catch (error) {
        console.error("Error generating images or processing response:", error);
        displayError('Error: Could not generate images. Please check the console for more details.');
    } finally {
        setLoading(false);
    }
}

// --- Event Listener ---
if (promptForm) {
    promptForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const prompt = promptInput.value.trim();
        generateImages(prompt);
    });
}
