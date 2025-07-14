/**
 * FHIR Inbox Tab Component
 * Manages clinical communications using FHIR Communication resources
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  Chip,
  Button,
  IconButton,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Inbox as InboxIcon,
  Send as SendIcon,
  Drafts as DraftsIcon,
  Mail as MailIcon,
  Reply as ReplyIcon,
  Forward as ForwardIcon,
  Delete as DeleteIcon,
  AttachFile as AttachIcon,
  PriorityHigh as HighPriorityIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  LocalHospital as ClinicalIcon,
  AdminPanelSettings as AdminIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { useClinical } from '../../../contexts/ClinicalContext';
import { fhirClient } from '../../../services/fhirClient';

const FHIRInboxTab = () => {
  const { currentPatient } = useClinical();
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [newMessage, setNewMessage] = useState({
    subject: '',
    content: '',
    priority: 'routine',
    category: 'notification',
    recipient: ''
  });

  useEffect(() => {
    if (currentPatient) {
      loadMessages();
    }
  }, [currentPatient?.id, filter]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      // Load communications about the patient
      const aboutPatient = await fhirClient.search('Communication', {
        subject: currentPatient.id,
        _sort: '-sent',
        _count: 100
      });

      // Load communications sent to the patient
      const toPatient = await fhirClient.search('Communication', {
        recipient: `Patient/${currentPatient.id}`,
        _sort: '-sent',
        _count: 100
      });

      // Combine and deduplicate
      const allMessages = [...(aboutPatient.resources || []), ...(toPatient.resources || [])];
      const uniqueMessages = Array.from(new Map(allMessages.map(m => [m.id, m])).values());

      const transformedMessages = uniqueMessages.map(transformFHIRCommunication);
      
      // Apply filter
      let filtered = transformedMessages;
      switch (filter) {
        case 'unread':
          filtered = transformedMessages.filter(m => m.status === 'in-progress');
          break;
        case 'starred':
          filtered = transformedMessages.filter(m => m.isStarred);
          break;
        case 'clinical':
          filtered = transformedMessages.filter(m => m.category === 'clinical');
          break;
        case 'administrative':
          filtered = transformedMessages.filter(m => m.category === 'administrative');
          break;
      }

      setMessages(filtered);
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  const transformFHIRCommunication = (comm) => ({
    id: comm.id,
    subject: comm.topic?.text || comm.reasonCode?.[0]?.text || 'No Subject',
    content: comm.payload?.[0]?.contentString || comm.payload?.[0]?.contentAttachment?.data || '',
    status: comm.status,
    priority: comm.priority || 'routine',
    category: comm.category?.[0]?.coding?.[0]?.code || 'notification',
    sent: comm.sent,
    received: comm.received,
    sender: comm.sender?.display || 'Unknown',
    senderReference: comm.sender,
    recipients: comm.recipient?.map(r => r.display || 'Unknown') || [],
    about: comm.subject,
    inResponseTo: comm.inResponseTo,
    isStarred: comm.extension?.find(e => e.url === 'http://wintehr.com/starred')?.valueBoolean || false,
    attachments: comm.payload?.filter(p => p.contentAttachment)?.map(p => p.contentAttachment) || []
  });

  const handleMarkAsRead = async (message) => {
    try {
      const comm = await fhirClient.read('Communication', message.id);
      comm.status = 'completed';
      comm.received = comm.received || new Date().toISOString();
      await fhirClient.update('Communication', message.id, comm);
      await loadMessages();
    } catch (error) {
      
    }
  };

  const handleToggleStar = async (message) => {
    try {
      const comm = await fhirClient.read('Communication', message.id);
      comm.extension = comm.extension || [];
      const starredExt = comm.extension.find(e => e.url === 'http://wintehr.com/starred');
      if (starredExt) {
        starredExt.valueBoolean = !starredExt.valueBoolean;
      } else {
        comm.extension.push({
          url: 'http://wintehr.com/starred',
          valueBoolean: true
        });
      }
      await fhirClient.update('Communication', message.id, comm);
      await loadMessages();
    } catch (error) {
      
    }
  };

  const handleSendMessage = async () => {
    try {
      const communication = {
        resourceType: 'Communication',
        status: 'in-progress',
        priority: newMessage.priority,
        subject: fhirClient.reference('Patient', currentPatient.id),
        topic: {
          text: newMessage.subject
        },
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/communication-category',
            code: newMessage.category
          }]
        }],
        payload: [{
          contentString: newMessage.content
        }],
        sent: new Date().toISOString(),
        sender: {
          display: 'Current User' // Would use actual user reference
        },
        recipient: newMessage.recipient ? [{
          display: newMessage.recipient
        }] : undefined,
        inResponseTo: replyTo ? [fhirClient.reference('Communication', replyTo.id)] : undefined
      };

      await fhirClient.create('Communication', communication);
      await loadMessages();
      setShowComposeDialog(false);
      resetNewMessage();
      setReplyTo(null);
    } catch (error) {
      
      alert('Failed to send message: ' + error.message);
    }
  };

  const handleDeleteMessage = async (message) => {
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      await fhirClient.delete('Communication', message.id);
      await loadMessages();
      setSelectedMessage(null);
    } catch (error) {
      
      alert('Failed to delete message: ' + error.message);
    }
  };

  const resetNewMessage = () => {
    setNewMessage({
      subject: '',
      content: '',
      priority: 'routine',
      category: 'notification',
      recipient: ''
    });
  };

  const getPriorityIcon = (priority) => {
    return priority === 'urgent' || priority === 'asap' || priority === 'stat' ? 
      <HighPriorityIcon color="error" fontSize="small" /> : null;
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'clinical':
        return <ClinicalIcon fontSize="small" />;
      case 'administrative':
        return <AdminIcon fontSize="small" />;
      default:
        return <MailIcon fontSize="small" />;
    }
  };

  const getStatusIcon = (status) => {
    return status === 'completed' ? <DraftsIcon /> : <MailIcon />;
  };

  const formatMessageDate = (date) => {
    if (!date) return 'Unknown';
    const messageDate = new Date(date);
    const now = new Date();
    const diffInHours = (now - messageDate) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return formatDistanceToNow(messageDate, { addSuffix: true });
    }
    return format(messageDate, 'MMM d, yyyy');
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 200px)' }}>
      {/* Message List */}
      <Paper sx={{ width: 350, mr: 2, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Messages</Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<SendIcon />}
              onClick={() => {
                setReplyTo(null);
                setShowComposeDialog(true);
              }}
            >
              Compose
            </Button>
          </Box>
          
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={(e, newFilter) => setFilter(newFilter || filter)}
            size="small"
            fullWidth
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="unread">Unread</ToggleButton>
            <ToggleButton value="starred">Starred</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <List sx={{ flex: 1, overflow: 'auto' }}>
          {messages.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">No messages</Typography>
            </Box>
          ) : (
            messages.map(message => (
              <ListItemButton
                key={message.id}
                selected={selectedMessage?.id === message.id}
                onClick={() => {
                  setSelectedMessage(message);
                  if (message.status === 'in-progress') {
                    handleMarkAsRead(message);
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar>{message.sender.charAt(0)}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {getStatusIcon(message.status)}
                      {getPriorityIcon(message.priority)}
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: message.status === 'in-progress' ? 'bold' : 'normal',
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {message.subject}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="caption" component="div">
                        From: {message.sender}
                      </Typography>
                      <Typography variant="caption" component="div">
                        {formatMessageDate(message.sent)}
                      </Typography>
                    </>
                  }
                />
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStar(message);
                  }}
                >
                  {message.isStarred ? <StarIcon color="warning" /> : <StarBorderIcon />}
                </IconButton>
              </ListItemButton>
            ))
          )}
        </List>
      </Paper>

      {/* Message Detail */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedMessage ? (
          <>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h6">{selectedMessage.subject}</Typography>
                  <Box display="flex" alignItems="center" gap={1} mt={1}>
                    <Chip
                      icon={getCategoryIcon(selectedMessage.category)}
                      label={selectedMessage.category}
                      size="small"
                    />
                    {selectedMessage.priority !== 'routine' && (
                      <Chip
                        icon={<HighPriorityIcon />}
                        label={selectedMessage.priority}
                        size="small"
                        color="error"
                      />
                    )}
                  </Box>
                </Box>
                <Box>
                  <IconButton onClick={() => {
                    setReplyTo(selectedMessage);
                    setNewMessage({
                      ...newMessage,
                      subject: `Re: ${selectedMessage.subject}`
                    });
                    setShowComposeDialog(true);
                  }}>
                    <ReplyIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDeleteMessage(selectedMessage)}>
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Box>
            </Box>

            <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    From: {selectedMessage.sender}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    To: {selectedMessage.recipients.join(', ')}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    Date: {format(new Date(selectedMessage.sent), 'PPPp')}
                  </Typography>
                </CardContent>
              </Card>

              <Typography variant="body1" paragraph style={{ whiteSpace: 'pre-wrap' }}>
                {selectedMessage.content}
              </Typography>

              {selectedMessage.attachments.length > 0 && (
                <Box mt={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    Attachments ({selectedMessage.attachments.length})
                  </Typography>
                  {selectedMessage.attachments.map((att, idx) => (
                    <Chip
                      key={idx}
                      icon={<AttachIcon />}
                      label={att.title || `Attachment ${idx + 1}`}
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography color="text.secondary">Select a message to view</Typography>
          </Box>
        )}
      </Paper>

      {/* Compose Dialog */}
      <Dialog
        open={showComposeDialog}
        onClose={() => {
          setShowComposeDialog(false);
          setReplyTo(null);
          resetNewMessage();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {replyTo ? `Reply to: ${replyTo.subject}` : 'New Message'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Recipient"
              value={newMessage.recipient}
              onChange={(e) => setNewMessage({ ...newMessage, recipient: e.target.value })}
              placeholder="Enter recipient name"
            />
            
            <TextField
              fullWidth
              label="Subject"
              value={newMessage.subject}
              onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
              required
            />

            <Box display="flex" gap={2}>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={newMessage.category}
                  onChange={(e) => setNewMessage({ ...newMessage, category: e.target.value })}
                  label="Category"
                >
                  <MenuItem value="notification">Notification</MenuItem>
                  <MenuItem value="clinical">Clinical</MenuItem>
                  <MenuItem value="administrative">Administrative</MenuItem>
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={newMessage.priority}
                  onChange={(e) => setNewMessage({ ...newMessage, priority: e.target.value })}
                  label="Priority"
                >
                  <MenuItem value="routine">Routine</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                  <MenuItem value="asap">ASAP</MenuItem>
                  <MenuItem value="stat">STAT</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <TextField
              fullWidth
              label="Message"
              value={newMessage.content}
              onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
              multiline
              rows={8}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowComposeDialog(false);
            setReplyTo(null);
            resetNewMessage();
          }}>
            Cancel
          </Button>
          <Button
            onClick={handleSendMessage}
            variant="contained"
            disabled={!newMessage.subject || !newMessage.content}
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FHIRInboxTab;