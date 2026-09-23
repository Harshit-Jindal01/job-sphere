// Cloudinary service structure
// Configuration constants should be stored in environment variables,
// not hardcoded in the frontend.

export const CLOUDINARY_CONFIG = {
    cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
    uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'jobsphere_media'
};

export const uploadToCloudinary = async (file) => {
    // To be implemented: fetch('https://api.cloudinary.com/v1_1/...')
    console.log('Upload initiated for:', file.name);
    return null;
};
