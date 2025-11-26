/**
 * Communication Panel Component
 * Real-time team communication for clinical documentation
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Paper,
  Typography,
  Box,
  Stack,
  TextField,
  Button,
  Avatar,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Badge,
  Tooltip,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Send as SendIcon,
  MoreVert as MoreIcon,
  Reply as ReplyIcon,
  Thread as ThreadIcon,
  AttachFile as AttachIcon,
  Notifications as NotificationIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Priority_High as UrgentIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { fhirClient } from '../../../../services/fhirClient';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';

const MessageBubble = ({ message, currentUserId, onReply, onThread }) => {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const isOwnMessage = message.sender?.reference?.includes(currentUserId);
  
  const getSenderName = () => {
    return message.sender?.display || 'Unknown User';
  };

  const getMessageTime = () => {
    const sentTime = message.sent || message.meta?.lastUpdated;
    return sentTime ? formatDistanceToNow(parseISO(sentTime), { addSuffix: true }) : '';
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
        mb: 1,
        mx: 1
      }}
    >
      <Box
        sx={{
          maxWidth: '70%',
          backgroundColor: isOwnMessage 
            ? 'primary.main' 
            : 'background.paper',
          color: isOwnMessage ? 'primary.contrastText' : 'text.primary',
          borderRadius: 2,
          p: 1.5,
          border: isOwnMessage ? 'none' : '1px solid',
          borderColor: 'divider',
          position: 'relative'
        }}
      >
        {!isOwnMessage && (
          <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}>
            {getSenderName()}
          </Typography>
        )}
        
        <Typography variant="body2">
          {message.payload?.[0]?.contentString || 'No content'}
        </Typography>
        
        {message.category?.[0]?.coding?.[0]?.code === 'urgent' && (
          <Chip
            icon={<UrgentIcon />}
            label="Urgent"
            size="small"
            color="error"
            sx={{ mt: 1, mr: 1 }}
          />
        )}

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {getMessageTime()}
          </Typography>
          
          <Stack direction="row" spacing={0.5}>
            <IconButton 
              size="small" 
              onClick={() => onReply(message)}
              sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
            >
              <ReplyIcon fontSize="small" />
            </IconButton>
            
            <IconButton 
              size="small" 
              onClick={() => onThread(message)}
              sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
            >
              <ThreadIcon fontSize="small" />
            </IconButton>
            
            <IconButton 
              size="small" 
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
            >
              <MoreIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => { onReply(message); handleMenuClose(); }}>
            <ReplyIcon sx={{ mr: 1 }} fontSize="small" />
            Reply
          </MenuItem>
          <MenuItem onClick={() => { onThread(message); handleMenuClose(); }}>
            <ThreadIcon sx={{ mr: 1 }} fontSize="small" />
            Start Thread
          </MenuItem>
          {isOwnMessage && (
            <MenuItem onClick={handleMenuClose}>
              Delete Message
            </MenuItem>
          )}
        </Menu>
      </Box>
    </Box>
  );
};

const RecipientSelector = ({ open, onClose, onSelect, availableRecipients }) => {
  const [selectedRecipients, setSelectedRecipients] = useState([]);

  const handleSelect = () => {
    onSelect(selectedRecipients);
    setSelectedRecipients([]);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Recipients</DialogTitle>
      <DialogContent>
        <Autocomplete
          multiple
          options={availableRecipients}
          getOptionLabel={(option) => option.display || option.name}
          value={selectedRecipients}
          onChange={(_, newValue) => setSelectedRecipients(newValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Recipients"
              placeholder="Search for team members..."
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 24, height: 24 }}>
                {option.display?.[0] || '?'}
              </Avatar>
              <Box>
                <Typography variant="body2">{option.display}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {option.role || 'Team Member'}
                </Typography>
              </Box>
            </Box>
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSelect} 
          variant="contained"
          disabled={selectedRecipients.length === 0}
        >
          Add Recipients
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const CommunicationPanel = ({ 
  patientId, 
  documentId = null, 
  encounterId = null,
  height = 400,
  onNewCommunication 
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [availableRecipients, setAvailableRecipients] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recipientDialogOpen, setRecipientDialogOpen] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef(null);
  const { publish, getCurrentUser } = useClinicalWorkflow();
  const currentUser = getCurrentUser();

  useEffect(() => {
    loadMessages();
    loadAvailableRecipients();
    
    // Set up polling for new messages (every 30 seconds)
    const pollInterval = setInterval(() => {
      loadMessages();
    }, 30000);
    
    return () => {
      clearInterval(pollInterval);
    };
  }, [patientId, documentId, selectedThread]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const searchParams = {
        subject: `Patient/${patientId}`,
        status: 'completed',
        _sort: 'sent',
        _count: 100
      };

      // Filter by document context if specified
      if (documentId) {
        searchParams.topic = `DocumentReference/${documentId}`;
      }

      // Filter by thread if selected
      if (selectedThread) {
        searchParams['based-on'] = `Communication/${selectedThread}`;
      }

      const response = await fhirClient.search('Communication', searchParams);
      setMessages(response.resources || []);
    } catch (err) {
      setError(`Failed to load messages: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableRecipients = async () => {
    try {
      // Load care team members for this patient
      const careTeamResponse = await fhirClient.search('CareTeam', {
        patient: patientId,
        status: 'active'
      });

      const practitioners = new Set();
      
      // Extract practitioners from care teams
      careTeamResponse.resources?.forEach(team => {
        team.participant?.forEach(participant => {
          if (participant.member?.reference?.startsWith('Practitioner/')) {
            practitioners.add(participant.member.reference);
          }
        });
      });

      // Load practitioner details
      const practitionerPromises = Array.from(practitioners).map(ref => {
        const id = ref.split('/')[1];
        return fhirClient.read('Practitioner', id).catch(() => null);
      });

      const practitionerDetails = await Promise.all(practitionerPromises);
      
      const recipients = practitionerDetails
        .filter(p => p)
        .map(practitioner => ({
          reference: `Practitioner/${practitioner.id}`,
          display: practitioner.name?.[0] 
            ? `${practitioner.name[0].family}, ${practitioner.name[0].given?.join(' ') || ''}`
            : practitioner.id,
          role: 'Practitioner'
        }));

      setAvailableRecipients(recipients);
    } catch (err) {
      // Failed to load recipients - recipient list will be limited
    }
  };


  const sendMessage = async () => {
    if (!newMessage.trim() || recipients.length === 0) return;

    setLoading(true);
    try {
      const communication = {
        resourceType: 'Communication',
        status: 'completed',
        category: isUrgent ? [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/communication-category',
            code: 'urgent',
            display: 'Urgent'
          }]
        }] : [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/communication-category',
            code: 'notification',
            display: 'Notification'
          }]
        }],
        subject: { reference: `Patient/${patientId}` },
        topic: documentId 
          ? { text: `Documentation Discussion - ${documentId}` }
          : { text: 'Clinical Communication' },
        sent: new Date().toISOString(),
        payload: [{
          contentString: newMessage
        }],
        sender: { 
          reference: `Practitioner/${currentUser?.id}`,
          display: currentUser?.name || 'Current User'
        },
        recipient: recipients.map(r => ({ reference: r.reference })),
        ...(replyingTo && {
          inResponseTo: [{ reference: `Communication/${replyingTo.id}` }]
        }),
        ...(selectedThread && {
          basedOn: [{ reference: `Communication/${selectedThread}` }]
        }),
        ...(documentId && {
          about: [{ reference: `DocumentReference/${documentId}` }]
        }),
        ...(encounterId && {
          encounter: { reference: `Encounter/${encounterId}` }
        })
      };

      const created = await fhirClient.create('Communication', communication);
      
      // Publish event for workflow integration
      await publish(CLINICAL_EVENTS.COMMUNICATION_SENT, {
        communicationId: created.id,
        patientId,
        documentId,
        recipients: recipients.map(r => r.reference),
        isUrgent,
        timestamp: new Date().toISOString()
      });

      // Clear form
      setNewMessage('');
      setReplyingTo(null);
      setIsUrgent(false);
      
      // Reload messages to show the new one
      await loadMessages();

      if (onNewCommunication) {
        onNewCommunication(created);
      }

    } catch (err) {
      setError(`Failed to send message: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    setRecipients([{
      reference: message.sender.reference,
      display: message.sender.display
    }]);
  };

  const handleThread = (message) => {
    setSelectedThread(message.id);
  };

  const handleAddRecipients = (newRecipients) => {
    setRecipients(prev => {
      const existing = new Set(prev.map(r => r.reference));
      const toAdd = newRecipients.filter(r => !existing.has(r.reference));
      return [...prev, ...toAdd];
    });
  };

  const removeRecipient = (recipientToRemove) => {
    setRecipients(prev => prev.filter(r => r.reference !== recipientToRemove.reference));
  };

  const markAsRead = () => {
    setUnreadCount(0);
  };

  return (
    <Paper sx={{ height, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupIcon />
            Team Communication
            {unreadCount > 0 && (
              <Badge badgeContent={unreadCount} color="error">
                <NotificationIcon />
              </Badge>
            )}
          </Typography>
          
          {selectedThread && (
            <Chip
              label="Thread View"
              onDelete={() => setSelectedThread(null)}
              size="small"
              color="primary"
            />
          )}
        </Stack>

        {documentId && (
          <Typography variant="caption" color="text.secondary">
            Document Context: {documentId}
          </Typography>
        )}
      </Box>

      {/* Messages */}
      <Box 
        sx={{ 
          flex: 1, 
          overflow: 'auto', 
          py: 1,
          backgroundColor: 'grey.50'
        }}
        onClick={markAsRead}
      >
        {loading && messages.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : messages.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" color="text.secondary">
              No messages yet. Start the conversation!
            </Typography>
          </Box>
        ) : (
          <>
            {messages.map(message => (
              <MessageBubble
                key={message.id}
                message={message}
                currentUserId={currentUser?.id}
                onReply={handleReply}
                onThread={handleThread}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </Box>

      {/* Error message */}
      {error && (
        <Alert severity="error" sx={{ mx: 2, my: 1 }}>
          {error}
        </Alert>
      )}

      {/* Recipients */}
      {recipients.length > 0 && (
        <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" gutterBottom>Recipients:</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {recipients.map(recipient => (
              <Chip
                key={recipient.reference}
                label={recipient.display}
                onDelete={() => removeRecipient(recipient)}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Reply context */}
      {replyingTo && (
        <Box sx={{ px: 2, py: 1, backgroundColor: 'action.hover' }}>
          <Typography variant="caption">
            Replying to: {replyingTo.sender?.display}
          </Typography>
          <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 0.5 }}>
            {replyingTo.payload?.[0]?.contentString?.substring(0, 100)}...
          </Typography>
          <IconButton 
            size="small" 
            onClick={() => setReplyingTo(null)}
            sx={{ mt: 0.5 }}
          >
            ×
          </IconButton>
        </Box>
      )}

      {/* Message input */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              multiline
              maxRows={3}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={recipients.length === 0 
                ? "Select recipients first..." 
                : "Type your message..."
              }
              disabled={recipients.length === 0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            
            <Stack direction="column" spacing={1}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setRecipientDialogOpen(true)}
                startIcon={<PersonIcon />}
              >
                {recipients.length === 0 ? 'Add' : `+${recipients.length}`}
              </Button>
              
              <Tooltip title="Mark as urgent">
                <IconButton
                  size="small"
                  onClick={() => setIsUrgent(!isUrgent)}
                  color={isUrgent ? 'error' : 'default'}
                >
                  <UrgentIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              {isUrgent && (
                <Chip
                  icon={<UrgentIcon />}
                  label="Urgent Message"
                  size="small"
                  color="error"
                  variant="outlined"
                />
              )}
            </Box>
            
            <Button
              variant="contained"
              onClick={sendMessage}
              disabled={!newMessage.trim() || recipients.length === 0 || loading}
              startIcon={<SendIcon />}
              size="small"
            >
              Send
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Recipient selector dialog */}
      <RecipientSelector
        open={recipientDialogOpen}
        onClose={() => setRecipientDialogOpen(false)}
        onSelect={handleAddRecipients}
        availableRecipients={availableRecipients}
      />
    </Paper>
  );
};

export default CommunicationPanel;