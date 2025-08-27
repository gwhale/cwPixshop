/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality } from '@google/genai';

// Initialize the Google AI client with the API key from environment variables.
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

// --- Page & Navigation Elements ---
const pages = document.querySelectorAll('.page');
const navButtons = {
    goToTextToImage: document.getElementById('go-to-text-to-image'),
    goToImageToImage: document.getElementById('go-to-image-to-image'),
    backButtons: document.querySelectorAll('.back-button'),
};

// --- Text-to-Image Page Elements ---
const textPromptForm = document.getElementById('text-prompt-form');
const textPromptInput = document.getElementById('text-prompt-input');
const textGenerateButton = document.getElementById('text-generate-button');
const textLoadingIndicator = document.getElementById('text-loading-indicator');
const textImageGallery = document.getElementById('text-image-gallery');

// --- Image-to-Image Page Elements ---
const imagePromptForm = document.getElementById('image-prompt-form');
const imagePromptInput = document.getElementById('image-prompt-input');
const imageGenerateButton = document.getElementById('image-generate-button');
const imageLoadingIndicator = document.getElementById('image-loading-indicator');
const imageEditGallery = document.getElementById('image-edit-gallery');
const imageUploadInput = document.getElementById('image-upload-input');
const uploadLabel = document.getElementById('upload-label');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageButton = document.getElementById('remove-image-button');

// --- Lightbox Elements ---
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.querySelector('.lightbox-close');

// --- App State ---
let uploadedImage = null; // To store { data: base64, mimeType: '...' }

// --- Navigation Logic ---
function showPage(pageId) {
    pages.forEach(page => {
        page.classList.toggle('hidden', page.id !== pageId);
    });
}

// --- Generic Helper Functions ---
function setLoading(indicator, button, isLoading) {
    indicator.classList.toggle('hidden', !isLoading);
    if (button) {
        button.disabled = isLoading;
    }
}

function displayError(gallery, message) {
    gallery.textContent = '';
    const errorParagraph = document.createElement('p');
    errorParagraph.textContent = message;
    errorParagraph.style.color = '#ff8a80'; // A lighter red for dark theme
    gallery.appendChild(errorParagraph);
}

function fileToGenerativePart(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64Data = reader.result.split(',')[1];
            resolve({
                data: base64Data,
                mimeType: file.type,
            });
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

function renderResultCard(gallery, src, prompt, index = 0) {
    // Create the main card container
    const card = document.createElement('div');
    card.classList.add('result-card');

    // Create the prompt display
    const promptText = document.createElement('p');
    promptText.textContent = `"${prompt}"`;

    // Create the image
    const img = new Image();
    img.src = src;
    img.alt = `${prompt} - Image ${index + 1}`;

    // Create the download button
    const downloadLink = document.createElement('a');
    downloadLink.href = src;
    const safePrompt = prompt.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    downloadLink.download = `pixshop-${safePrompt}-${index + 1}.jpeg`;
    downloadLink.textContent = 'Download';
    downloadLink.classList.add('download-button');
    downloadLink.setAttribute('role', 'button');

    // Create a container for actions
    const actionsContainer = document.createElement('div');
    actionsContainer.classList.add('card-actions');
    actionsContainer.appendChild(downloadLink);

    // Append elements to the card
    card.appendChild(promptText);
    card.appendChild(img);
    card.appendChild(actionsContainer);

    // Append the card to the gallery
    gallery.appendChild(card);
}


// --- Core Logic: Text-to-Image ---
async function handleTextToImage(prompt) {
    if (!prompt) {
        displayError(textImageGallery, 'Please enter a prompt.');
        return;
    }
    setLoading(textLoadingIndicator, textGenerateButton, true);
    textImageGallery.textContent = '';

    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: '1:1',
                outputMimeType: 'image/jpeg',
            },
        });

        if (response?.generatedImages) {
             response.generatedImages.forEach((generatedImage, index) => {
                if (generatedImage.image?.imageBytes) {
                    const src = `data:image/jpeg;base64,${generatedImage.image.imageBytes}`;
                    renderResultCard(textImageGallery, src, prompt, index);
                }
            });
        } else {
             displayError(textImageGallery, "Image generation failed. No images were returned.");
        }
    } catch (error) {
        console.error("Text-to-Image Error:", error);
        displayError(textImageGallery, `Error: Could not generate images. ${error.message || 'Please check the console for details.'}`);
    } finally {
        setLoading(textLoadingIndicator, textGenerateButton, false);
    }
}

// --- Core Logic: Image-to-Image ---
async function handleImageToImage(prompt) {
    if (!prompt) {
        displayError(imageEditGallery, 'Please enter a prompt.');
        return;
    }
    if (!uploadedImage) {
        displayError(imageEditGallery, 'Please upload an image first.');
        return;
    }
    setLoading(imageLoadingIndicator, imageGenerateButton, true);
    imageEditGallery.textContent = '';

    try {
        const imagePart = { inlineData: uploadedImage };
        const textPart = { text: prompt };
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        const parts = response.candidates[0].content.parts;
        let foundImage = false;
        for (const part of parts) {
            if (part.inlineData) {
                const { data, mimeType } = part.inlineData;
                renderResultCard(imageEditGallery, `data:${mimeType};base64,${data}`, prompt);
                foundImage = true;
            }
        }
        if (!foundImage) {
             displayError(imageEditGallery, "No image was generated. The model may have responded with text only. Please try a different prompt.");
        }
    } catch (error) {
        console.error("Image-to-Image Error:", error);
        displayError(imageEditGallery, `Error: Could not enhance the image. ${error.message || 'Please check the console for details.'}`);
    } finally {
        setLoading(imageLoadingIndicator, imageGenerateButton, false);
    }
}

// --- Lightbox Logic ---
function handleLightboxKeydown(e) {
    if (e.key === 'Escape') {
        closeLightbox();
    }
}

function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt;
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    document.addEventListener('keydown', handleLightboxKeydown);
}

function closeLightbox() {
    lightbox.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
    document.removeEventListener('keydown', handleLightboxKeydown);
}


// --- Event Listeners Setup ---
// Navigation
navButtons.goToTextToImage.addEventListener('click', () => showPage('text-to-image-page'));
navButtons.goToImageToImage.addEventListener('click', () => showPage('image-to-image-page'));
navButtons.backButtons.forEach(button => {
    button.addEventListener('click', () => showPage(button.dataset.target));
});

// Text-to-Image Form
textPromptForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const prompt = textPromptInput.value.trim();
    handleTextToImage(prompt);
});

// Image-to-Image Form
imagePromptForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const prompt = imagePromptInput.value.trim();
    handleImageToImage(prompt);
});

// Image Upload Logic
imageUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        uploadedImage = await fileToGenerativePart(file);
        imagePreview.src = URL.createObjectURL(file);
        imagePreviewContainer.classList.remove('hidden');
        uploadLabel.classList.add('hidden');
    } catch (error) {
        console.error("Error processing file:", error);
        displayError(imageEditGallery, `Could not process the uploaded file. ${error.message || ''}`);
        uploadedImage = null;
    }
});

removeImageButton.addEventListener('click', () => {
    uploadedImage = null;
    imageUploadInput.value = ''; // Reset file input
    imagePreviewContainer.classList.add('hidden');
    uploadLabel.classList.remove('hidden');
    // Revoke the object URL to free up memory
    if (imagePreview.src) {
        URL.revokeObjectURL(imagePreview.src);
        imagePreview.src = '#';
    }
});

// Lightbox events
lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
    // Close if the click is on the background overlay, not the image itself
    if (e.target === lightbox) {
        closeLightbox();
    }
});

// Gallery click events for opening lightbox (using event delegation)
function handleGalleryClick(e) {
    if (e.target.tagName === 'IMG') {
        openLightbox(e.target.src, e.target.alt);
    }
}
textImageGallery.addEventListener('click', handleGalleryClick);
imageEditGallery.addEventListener('click', handleGalleryClick);


// --- Initial Setup ---
showPage('home-page'); // Show the home page on initial load
