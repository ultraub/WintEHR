/**
 * Imaging utilities for DICOM download and sharing
 */

import axios from 'axios';

/**
 * Download a DICOM study as a zip file
 * @param {Object} study - FHIR ImagingStudy resource
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<void>}
 */
export const downloadDICOMStudy = async (study, onProgress) => {
  try {
    // Notify start
    if (onProgress) onProgress(0);
    
    const studyId = study.id || study.identifier?.[0]?.value;
    if (!studyId) {
      throw new Error('Study ID not found');
    }
    
    // Request DICOM download from backend
    const response = await axios({
      method: 'GET',
      url: `/api/dicom/studies/${studyId}/download`,
      responseType: 'blob',
      onDownloadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename
    const studyDate = study.started ? new Date(study.started).toISOString().split('T')[0] : 'unknown-date';
    const modality = study.modality?.[0]?.code || 'DICOM';
    const filename = `${modality}_${studyDate}_${studyId}.zip`;
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    // Clean up
    window.URL.revokeObjectURL(url);
    
    if (onProgress) onProgress(100);
  } catch (error) {
    // Propagate error to caller
    throw new Error(error.response?.data?.message || 'Failed to download study');
  }
};

/**
 * Download a single DICOM series
 * @param {string} studyId - Study ID
 * @param {string} seriesId - Series ID
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<void>}
 */
export const downloadDICOMSeries = async (studyId, seriesId, onProgress) => {
  try {
    const response = await axios({
      method: 'GET',
      url: `/api/dicom/studies/${studyId}/series/${seriesId}/download`,
      responseType: 'blob',
      onDownloadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `series_${seriesId}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    // Propagate error to caller
    throw new Error('Failed to download series');
  }
};

/**
 * Generate a shareable link for a DICOM study
 * @param {Object} study - FHIR ImagingStudy resource
 * @param {Object} options - Share options
 * @param {number} options.expirationHours - Link expiration in hours (default: 72)
 * @param {boolean} options.requireAuth - Require authentication (default: true)
 * @returns {Promise<Object>} Share link information
 */
export const generateShareLink = async (study, options = {}) => {
  try {
    const studyId = study.id || study.identifier?.[0]?.value;
    if (!studyId) {
      throw new Error('Study ID not found');
    }
    
    const response = await axios.post('/api/dicom/share', {
      studyId,
      expirationHours: options.expirationHours || 72,
      requireAuth: options.requireAuth !== false,
      studyDescription: study.description || 'Imaging Study',
      patientReference: study.subject?.reference
    });
    
    return {
      shareUrl: response.data.shareUrl,
      shareCode: response.data.shareCode,
      expiresAt: response.data.expiresAt
    };
  } catch (error) {
    // Propagate error to caller
    throw new Error(error.response?.data?.message || 'Failed to generate share link');
  }
};

/**
 * Export DICOM images as JPEG/PNG
 * @param {string} studyId - Study ID
 * @param {string} format - Export format ('jpeg' or 'png')
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<void>}
 */
export const exportDICOMImages = async (studyId, format = 'jpeg', onProgress) => {
  try {
    const response = await axios({
      method: 'POST',
      url: `/api/dicom/studies/${studyId}/export`,
      data: { format },
      responseType: 'blob',
      onDownloadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `images_${studyId}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    // Propagate error to caller
    throw new Error('Failed to export images');
  }
};

/**
 * Copy share link to clipboard
 * @param {string} shareUrl - URL to copy
 * @returns {Promise<boolean>} Success status
 */
export const copyShareLink = async (shareUrl) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareUrl);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    }
  } catch (error) {
    // Propagate error to caller
    return false;
  }
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};