// Debug script to check note content processing
// Run this in browser console on Documentation tab

console.log('=== DocumentReference Content Debug ===');

// Check if we have access to the context
if (window.React && window.React.version) {
  console.log('React version:', window.React.version);
}

// Try to access patient resources
const checkDocumentReferences = () => {
  // Look for DocumentReference resources in the page
  const docRefs = Array.from(document.querySelectorAll('[data-resource-type="DocumentReference"]'));
  console.log('Found DocumentReference elements:', docRefs.length);
  
  // Check local storage for FHIR resources
  const storageKeys = Object.keys(localStorage).filter(key => 
    key.includes('DocumentReference') || key.includes('fhir') || key.includes('patient')
  );
  console.log('Relevant localStorage keys:', storageKeys);
  
  // Try to find any DocumentReference objects in global scope
  const checkGlobal = (obj, path = '') => {
    if (typeof obj !== 'object' || obj === null) return;
    
    Object.keys(obj).forEach(key => {
      try {
        const val = obj[key];
        if (val && typeof val === 'object') {
          if (val.resourceType === 'DocumentReference') {
            console.log(`Found DocumentReference at ${path}.${key}:`, val);
            
            // Check content structure
            if (val.content && val.content[0] && val.content[0].attachment) {
              const attachment = val.content[0].attachment;
              console.log('Content attachment:', {
                contentType: attachment.contentType,
                hasData: !!attachment.data,
                dataLength: attachment.data?.length,
                title: attachment.title
              });
              
              // Try to decode the data
              if (attachment.data) {
                try {
                  const decoded = atob(attachment.data);
                  console.log('Decoded content preview:', decoded.substring(0, 200) + '...');
                } catch (e) {
                  console.log('Failed to decode base64:', e.message);
                }
              }
            }
          }
          
          if (path.split('.').length < 3) { // Prevent infinite recursion
            checkGlobal(val, path ? `${path}.${key}` : key);
          }
        }
      } catch (e) {
        // Skip inaccessible properties
      }
    });
  };
  
  // Check window object
  checkGlobal(window, 'window');
};

// Run the check
checkDocumentReferences();

// Also check if we can access the DocumentReferenceConverter
if (window.documentReferenceConverter) {
  console.log('DocumentReferenceConverter available:', window.documentReferenceConverter);
} else {
  console.log('DocumentReferenceConverter not found in global scope');
}

console.log('=== End Debug ===');