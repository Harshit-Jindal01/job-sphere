// =============================================================
//  CLOUDINARY SERVICE  (single source of truth for all uploads)
// =============================================================
//  Configuration is read from Vite env vars (see .env):
//    VITE_CLOUDINARY_CLOUD_NAME     -> Cloudinary cloud name
//    VITE_CLOUDINARY_UPLOAD_PRESET  -> UNSIGNED upload preset name
//
//  No API secret is (or should ever be) used in the browser.
//  Uploads go through the unsigned preset, so only the cloud name
//  and the preset name are needed client side.
//
//  This one function is reused by every upload in the app:
//    - post images      -> 'jobsphere/posts'
//    - resumes          -> 'jobsphere/resumes'
//    - profile photos   -> 'jobsphere/profile-photos'
// =============================================================

export const CLOUDINARY_CONFIG = {
    cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
    uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''
};

export const isCloudinaryConfigured = () =>
    Boolean(CLOUDINARY_CONFIG.cloudName && CLOUDINARY_CONFIG.uploadPreset);

/**
 * Upload a file to Cloudinary using the unsigned upload preset.
 *
 * @param {File|Blob} file            the file to upload
 * @param {string} [folder]           optional destination folder
 * @returns {Promise<{url: string, publicId: string|null, resourceType: string|null, format: string|null}>}
 * @throws {Error} with a human readable message on any failure
 */
export const uploadToCloudinary = async (file, folder = 'jobsphere') => {
    if (!file) {
        throw new Error('No file selected.');
    }

    if (!isCloudinaryConfigured()) {
        throw new Error(
            'Image upload is not configured. Please contact support.'
        );
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    if (folder) {
        formData.append('folder', folder);
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`;

    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });
    } catch {
        throw new Error('Upload failed: could not reach Cloudinary. Check your connection and try again.');
    }

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok || data?.error) {
        throw new Error(
            data?.error?.message ||
            `Upload failed (Cloudinary responded with ${response.status}).`
        );
    }

    if (!data?.secure_url) {
        throw new Error('Upload finished but no file URL was returned. Please try again.');
    }

    return {
        url: data.secure_url,
        publicId: data.public_id || null,
        resourceType: data.resource_type || null,
        format: data.format || null
    };
};

/**
 * Cloudinary returns documents as `/fl_attachment/...` when the preset is
 * configured for attachment delivery, which renders inline instead of
 * downloading. Strip it so resume links open normally.
 */
export const getCleanResumeUrl = (url) => {
    if (!url) return null;
    return url.replace('/fl_attachment/', '/');
};
