/**
 * Timeline Export Utilities
 * Handles exporting timeline visualizations to various formats
 */

/**
 * Export timeline to PNG format using browser's print functionality
 * Note: For actual PNG export, html2canvas package would need to be installed
 */
export const exportToPNG = async (element, filename = 'timeline') => {
  try {
    // Open print dialog as a fallback when html2canvas is not available
    window.print();
    console.warn('PNG export requires html2canvas package. Using print dialog as fallback.');
    return true;
  } catch (error) {
    console.error('PNG export failed:', error);
    throw error;
  }
};

/**
 * Export timeline to PDF format using browser's print functionality
 * Note: For actual PDF export, jspdf package would need to be installed
 */
export const exportToPDF = async (element, filename = 'timeline') => {
  try {
    // Open print dialog and suggest saving as PDF
    window.print();
    console.warn('PDF export requires jspdf package. Use browser print dialog to save as PDF.');
    return true;
  } catch (error) {
    console.error('PDF export failed:', error);
    throw error;
  }
};

/**
 * Export timeline data to JSON format
 */
export const exportToJSON = (data, filename = 'timeline-data') => {
  try {
    const exportData = {
      ...data,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('JSON export failed:', error);
    throw error;
  }
};

/**
 * Export timeline to SVG format
 * This creates a basic SVG representation of the timeline
 */
export const exportToSVG = (timelineData, dimensions, filename = 'timeline') => {
  try {
    const { width = 1200, height = 600 } = dimensions;
    const trackHeight = height / (timelineData.tracks?.length || 1);
    
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="${width}" height="${height}" fill="white"/>`;
    
    // Draw tracks
    timelineData.tracks?.forEach((track, index) => {
      const y = index * trackHeight;
      
      // Track background
      svg += `<rect x="0" y="${y}" width="${width}" height="${trackHeight}" fill="#f5f5f5" stroke="#e0e0e0"/>`;
      
      // Track label
      svg += `<text x="10" y="${y + trackHeight/2}" font-family="Arial" font-size="14" alignment-baseline="middle">${track.resourceType}</text>`;
      
      // Events
      track.events?.forEach(event => {
        const x = (event.position / width) * width;
        const eventWidth = Math.max(50, event.duration || 1);
        
        svg += `<rect x="${x}" y="${y + 10}" width="${eventWidth}" height="${trackHeight - 20}" fill="${getResourceColor(track.resourceType)}" opacity="0.8" rx="4"/>`;
        svg += `<text x="${x + 5}" y="${y + trackHeight/2}" font-family="Arial" font-size="10" fill="white" alignment-baseline="middle">${event.title || ''}</text>`;
      });
    });
    
    svg += '</svg>';
    
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('SVG export failed:', error);
    throw error;
  }
};

// Helper function to get resource colors
const getResourceColor = (resourceType) => {
  const colors = {
    Encounter: '#1976d2',
    Condition: '#d32f2f',
    MedicationRequest: '#ed6c02',
    Procedure: '#7b1fa2',
    Observation: '#388e3c',
    DiagnosticReport: '#00897b'
  };
  return colors[resourceType] || '#757575';
};
