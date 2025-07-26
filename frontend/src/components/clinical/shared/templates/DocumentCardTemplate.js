/**
 * DocumentCardTemplate Component
 * Standardized template for displaying FHIR DocumentReference resources
 * Based on Chart Review Tab's EnhancedDocumentCard
 */
import React from 'react';
import { Chip, Stack, Typography, IconButton } from '@mui/material';
import { 
  Description as DescriptionIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  VideoFile as VideoIcon,
  AudioFile as AudioIcon,
  Article as ArticleIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import ClinicalResourceCard from '../cards/ClinicalResourceCard';

/**
 * Template for displaying document reference information
 * @param {Object} props
 * @param {Object} props.document - FHIR DocumentReference resource
 * @param {Function} props.onEdit - Edit handler
 * @param {Function} props.onMore - More menu handler
 * @param {Function} props.onView - View document handler
 * @param {boolean} props.isAlternate - Alternate row styling
 */
const DocumentCardTemplate = ({ document, onEdit, onMore, onView, isAlternate = false }) => {
  if (!document) return null;
  
  // Extract FHIR data
  const title = document.description || 
               document.type?.text || 
               document.type?.coding?.[0]?.display || 
               'Clinical Document';
  const status = document.status || 'current';
  const isCurrent = status === 'current';
  
  // Get document icon based on MIME type
  const getDocumentIcon = () => {
    const mimeType = document.content?.[0]?.attachment?.contentType;
    if (!mimeType) return <DescriptionIcon />;
    
    if (mimeType.includes('pdf')) return <PdfIcon />;
    if (mimeType.includes('image')) return <ImageIcon />;
    if (mimeType.includes('video')) return <VideoIcon />;
    if (mimeType.includes('audio')) return <AudioIcon />;
    if (mimeType.includes('text') || mimeType.includes('html')) return <ArticleIcon />;
    return <DescriptionIcon />;
  };
  
  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return null;
    const kb = bytes / 1024;
    const mb = kb / 1024;
    
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    if (kb >= 1) return `${Math.round(kb)} KB`;
    return `${bytes} bytes`;
  };
  
  // Build details array
  const details = [];
  
  // Date
  if (document.date) {
    details.push({ 
      label: 'Date', 
      value: format(new Date(document.date), 'MMM d, yyyy h:mm a') 
    });
  }
  
  // Author
  if (document.author?.[0]) {
    const author = document.author[0].display || 'Unknown author';
    details.push({ label: 'Author', value: author });
  }
  
  // Document details
  if (document.content?.[0]?.attachment) {
    const attachment = document.content[0].attachment;
    const fileDetails = [];
    
    if (attachment.contentType) {
      fileDetails.push(attachment.contentType);
    }
    
    const fileSize = formatFileSize(attachment.size);
    if (fileSize) {
      fileDetails.push(fileSize);
    }
    
    if (fileDetails.length > 0) {
      details.push({ label: 'Type', value: fileDetails.join(' • ') });
    }
    
    // Creation date if different from document date
    if (attachment.creation && attachment.creation !== document.date) {
      details.push({ 
        label: 'Created', 
        value: format(new Date(attachment.creation), 'MMM d, yyyy') 
      });
    }
  }
  
  // Encounter context
  if (document.context?.encounter?.[0]) {
    details.push({ 
      label: 'Encounter', 
      value: document.context.encounter[0].display || 'Related encounter' 
    });
  }
  
  // Period
  if (document.context?.period) {
    const period = document.context.period;
    if (period.start) {
      const periodText = format(new Date(period.start), 'MMM d, yyyy');
      if (period.end) {
        details.push({ 
          label: 'Period', 
          value: `${periodText} - ${format(new Date(period.end), 'MMM d, yyyy')}` 
        });
      } else {
        details.push({ label: 'Period Start', value: periodText });
      }
    }
  }
  
  // Custodian
  if (document.custodian?.display) {
    details.push({ label: 'Custodian', value: document.custodian.display });
  }
  
  // Build title with document status
  const titleElement = (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="body1" fontWeight={600}>
        {title}
      </Typography>
      {document.docStatus && (
        <Chip 
          label={document.docStatus} 
          size="small" 
          variant="outlined"
        />
      )}
    </Stack>
  );
  
  // Custom actions including view
  const actions = (
    <>
      {onView && document.content?.[0]?.attachment?.url && (
        <IconButton size="small" onClick={() => onView(document)}>
          <VisibilityIcon fontSize="small" />
        </IconButton>
      )}
    </>
  );
  
  return (
    <ClinicalResourceCard
      title={titleElement}
      icon={getDocumentIcon()}
      severity="normal"
      status={status}
      statusColor={isCurrent ? 'default' : 'warning'}
      details={details}
      onEdit={onEdit}
      onMore={onMore}
      isAlternate={isAlternate}
      actions={actions}
    />
  );
};

export default DocumentCardTemplate;