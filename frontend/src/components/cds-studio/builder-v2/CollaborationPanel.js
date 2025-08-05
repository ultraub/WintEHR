/**
 * Collaboration Panel
 * Collaboration features for CDS service development
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Stack,
  Chip,
  Avatar,
  Button,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tabs,
  Tab,
  Badge,
  Tooltip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  AvatarGroup
} from '@mui/material';
import {
  Group as TeamIcon,
  Person as PersonIcon,
  Comment as CommentIcon,
  Share as ShareIcon,
  History as HistoryIcon,
  Star as StarIcon,
  CallSplit as ForkIcon,
  MergeType as MergeIcon,
  Add as AddIcon,
  Send as SendIcon,
  Notifications as NotificationsIcon,
  Public as PublicIcon,
  Lock as PrivateIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Reply as ReplyIcon
} from '@mui/icons-material';

// Mock collaboration data
const MOCK_COLLABORATION_DATA = {
  teamMembers: [
    {
      id: 'user-1',
      name: 'Dr. Sarah Johnson',
      role: 'Clinical Lead',
      avatar: null,
      status: 'online',
      permissions: 'editor'
    },
    {
      id: 'user-2',
      name: 'Mike Chen',
      role: 'Clinical Informaticist',
      avatar: null,
      status: 'online',
      permissions: 'admin'
    },
    {
      id: 'user-3',
      name: 'Dr. Lisa Rodriguez',
      role: 'Quality Officer',
      avatar: null,
      status: 'offline',
      permissions: 'reviewer'
    },
    {
      id: 'user-4',
      name: 'James Wilson',
      role: 'Software Developer',
      avatar: null,
      status: 'away',
      permissions: 'editor'
    }
  ],
  comments: [
    {
      id: 'comment-1',
      author: 'Dr. Sarah Johnson',
      content: 'The diabetes screening logic looks good, but we should consider adding BMI as an additional risk factor.',
      timestamp: '2024-02-07T14:30:00Z',
      replies: [
        {
          id: 'reply-1',
          author: 'Mike Chen',
          content: 'Good point! I can add that to the condition node. Should we use BMI >= 25 as the threshold?',
          timestamp: '2024-02-07T14:45:00Z'
        }
      ]
    },
    {
      id: 'comment-2',
      author: 'Dr. Lisa Rodriguez',
      content: 'From a quality perspective, this aligns well with USPSTF guidelines. We should document the evidence level.',
      timestamp: '2024-02-07T13:15:00Z',
      replies: []
    },
    {
      id: 'comment-3',
      author: 'James Wilson',
      content: 'The execution time looks optimal. Performance metrics are within acceptable ranges.',
      timestamp: '2024-02-07T12:00:00Z',
      replies: []
    }
  ],
  versions: [
    {
      id: 'v1.0.0',
      author: 'Mike Chen',
      timestamp: '2024-02-07T10:00:00Z',
      message: 'Initial implementation of diabetes screening service',
      status: 'published'
    },
    {
      id: 'v1.1.0',
      author: 'Dr. Sarah Johnson',
      timestamp: '2024-02-07T14:00:00Z',
      message: 'Added BMI risk factor and improved card messaging',
      status: 'draft'
    },
    {
      id: 'v1.2.0',
      author: 'Mike Chen',
      timestamp: '2024-02-07T16:00:00Z',
      message: 'Performance optimizations and bug fixes',
      status: 'review'
    }
  ],
  sharing: {
    visibility: 'team', // 'private', 'team', 'organization', 'public'
    allowComments: true,
    allowForks: true,
    shareableLink: 'https://wintehr.com/cds/shared/diabetes-screening-v2'
  }
};

const CollaborationPanel = ({
  service,
  collaborationEnabled = false,
  onCollaborationToggle
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('reviewer');
  const [collaborationData, setCollaborationData] = useState(MOCK_COLLABORATION_DATA);

  // Handle adding new comment
  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment = {
      id: `comment-${Date.now()}`,
      author: 'Current User',
      content: newComment,
      timestamp: new Date().toISOString(),
      replies: []
    };

    setCollaborationData(prev => ({
      ...prev,
      comments: [comment, ...prev.comments]
    }));

    setNewComment('');
  };

  // Handle adding reply
  const handleAddReply = (commentId, replyContent) => {
    if (!replyContent.trim()) return;

    const reply = {
      id: `reply-${Date.now()}`,
      author: 'Current User',
      content: replyContent,
      timestamp: new Date().toISOString()
    };

    setCollaborationData(prev => ({
      ...prev,
      comments: prev.comments.map(comment => 
        comment.id === commentId 
          ? { ...comment, replies: [...comment.replies, reply] }
          : comment
      )
    }));

    setReplyingTo(null);
  };

  // Handle team member invitation
  const handleInviteTeamMember = () => {
    if (!inviteEmail.trim()) return;

    const newMember = {
      id: `user-${Date.now()}`,
      name: inviteEmail.split('@')[0],
      role: 'Invited User',
      avatar: null,
      status: 'pending',
      permissions: inviteRole
    };

    setCollaborationData(prev => ({
      ...prev,
      teamMembers: [...prev.teamMembers, newMember]
    }));

    setInviteEmail('');
    setInviteRole('reviewer');
    setShowInviteDialog(false);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'success';
      case 'away': return 'warning';
      case 'offline': return 'default';
      case 'pending': return 'info';
      default: return 'default';
    }
  };

  // Get role icon
  const getRoleIcon = (role) => {
    if (role.includes('Dr.')) return '👨‍⚕️';
    if (role.includes('Clinical')) return '🩺';
    if (role.includes('Quality')) return '📊';
    if (role.includes('Developer')) return '💻';
    return '👤';
  };

  // Render team members tab
  const renderTeamTab = () => (
    <Stack spacing={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Team Members</Typography>
        <Button
          startIcon={<AddIcon />}
          variant="outlined"
          onClick={() => setShowInviteDialog(true)}
        >
          Invite Member
        </Button>
      </Box>

      <List>
        {collaborationData.teamMembers.map((member) => (
          <ListItem key={member.id}>
            <ListItemIcon>
              <Badge
                color={getStatusColor(member.status)}
                variant="dot"
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              >
                <Avatar sx={{ width: 40, height: 40 }}>
                  {member.name.split(' ').map(n => n[0]).join('')}
                </Avatar>
              </Badge>
            </ListItemIcon>
            <ListItemText
              primary={
                <Box display="flex" alignItems="center">
                  <Typography variant="body1" sx={{ mr: 1 }}>
                    {member.name}
                  </Typography>
                  <Typography component="span" sx={{ fontSize: '1rem' }}>
                    {getRoleIcon(member.role)}
                  </Typography>
                </Box>
              }
              secondary={
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {member.role}
                  </Typography>
                  <Chip
                    label={member.permissions}
                    size="small"
                    variant="outlined"
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              }
            />
            <ListItemSecondaryAction>
              <Chip
                label={member.status}
                size="small"
                color={getStatusColor(member.status)}
                variant="outlined"
              />
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
    </Stack>
  );

  // Render comments tab
  const renderCommentsTab = () => (
    <Stack spacing={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Comments & Feedback</Typography>
        <Badge badgeContent={collaborationData.comments.length} color="primary">
          <CommentIcon />
        </Badge>
      </Box>

      {/* Add new comment */}
      <Card variant="outlined">
        <CardContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="Add a comment or suggestion..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            variant="outlined"
          />
        </CardContent>
        <CardActions>
          <Button
            startIcon={<SendIcon />}
            variant="contained"
            onClick={handleAddComment}
            disabled={!newComment.trim()}
          >
            Post Comment
          </Button>
        </CardActions>
      </Card>

      {/* Comments list */}
      <Stack spacing={2}>
        {collaborationData.comments.map((comment) => (
          <Card key={comment.id} variant="outlined">
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Avatar sx={{ width: 32, height: 32, mr: 1 }}>
                  {comment.author.split(' ').map(n => n[0]).join('')}
                </Avatar>
                <Box>
                  <Typography variant="subtitle2">{comment.author}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(comment.timestamp).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {comment.content}
              </Typography>
              
              {/* Replies */}
              {comment.replies.length > 0 && (
                <Box sx={{ ml: 4, mt: 2, borderLeft: 2, borderColor: 'divider', pl: 2 }}>
                  {comment.replies.map((reply) => (
                    <Box key={reply.id} sx={{ mb: 1 }}>
                      <Box display="flex" alignItems="center" mb={0.5}>
                        <Avatar sx={{ width: 24, height: 24, mr: 1 }}>
                          {reply.author.split(' ').map(n => n[0]).join('')}
                        </Avatar>
                        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                          {reply.author}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          {new Date(reply.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                      <Typography variant="body2">
                        {reply.content}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
            <CardActions>
              <Button
                size="small"
                startIcon={<ReplyIcon />}
                onClick={() => setReplyingTo(comment.id)}
              >
                Reply
              </Button>
            </CardActions>

            {/* Reply input */}
            {replyingTo === comment.id && (
              <CardContent sx={{ pt: 0 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Write a reply..."
                  variant="outlined"
                  size="small"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddReply(comment.id, e.target.value);
                      e.target.value = '';
                    }
                  }}
                />
              </CardContent>
            )}
          </Card>
        ))}
      </Stack>
    </Stack>
  );

  // Render version history tab
  const renderVersionHistoryTab = () => (
    <Stack spacing={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Version History</Typography>
        <Button startIcon={<ForkIcon />} variant="outlined">
          Create Fork
        </Button>
      </Box>

      <List>
        {collaborationData.versions.map((version, index) => (
          <ListItem key={version.id} divider={index < collaborationData.versions.length - 1}>
            <ListItemIcon>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                v{version.id.split('.')[1]}
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={
                <Box display="flex" alignItems="center">
                  <Typography variant="subtitle2" sx={{ mr: 1 }}>
                    {version.id}
                  </Typography>
                  <Chip
                    label={version.status}
                    size="small"
                    color={
                      version.status === 'published' ? 'success' :
                      version.status === 'review' ? 'warning' : 'default'
                    }
                    variant="outlined"
                  />
                </Box>
              }
              secondary={
                <Box>
                  <Typography variant="body2">
                    {version.message}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    by {version.author} • {new Date(version.timestamp).toLocaleString()}
                  </Typography>
                </Box>
              }
            />
            <ListItemSecondaryAction>
              <IconButton size="small">
                <HistoryIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
    </Stack>
  );

  // Render sharing tab
  const renderSharingTab = () => (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" gutterBottom>Sharing Settings</Typography>
        
        <Card variant="outlined">
          <CardContent>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Visibility</InputLabel>
              <Select
                value={collaborationData.sharing.visibility}
                label="Visibility"
                onChange={(e) => setCollaborationData(prev => ({
                  ...prev,
                  sharing: { ...prev.sharing, visibility: e.target.value }
                }))}
              >
                <MenuItem value="private">
                  <Box display="flex" alignItems="center">
                    <PrivateIcon sx={{ mr: 1 }} />
                    Private - Only you
                  </Box>
                </MenuItem>
                <MenuItem value="team">
                  <Box display="flex" alignItems="center">
                    <TeamIcon sx={{ mr: 1 }} />
                    Team - Team members only
                  </Box>
                </MenuItem>
                <MenuItem value="organization">
                  <Box display="flex" alignItems="center">
                    <PersonIcon sx={{ mr: 1 }} />
                    Organization - All organization members
                  </Box>
                </MenuItem>
                <MenuItem value="public">
                  <Box display="flex" alignItems="center">
                    <PublicIcon sx={{ mr: 1 }} />
                    Public - Anyone with the link
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            <Stack spacing={1}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">Allow comments</Typography>
                <Button
                  variant={collaborationData.sharing.allowComments ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setCollaborationData(prev => ({
                    ...prev,
                    sharing: { ...prev.sharing, allowComments: !prev.sharing.allowComments }
                  }))}
                >
                  {collaborationData.sharing.allowComments ? 'Enabled' : 'Disabled'}
                </Button>
              </Box>

              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">Allow forks</Typography>
                <Button
                  variant={collaborationData.sharing.allowForks ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setCollaborationData(prev => ({
                    ...prev,
                    sharing: { ...prev.sharing, allowForks: !prev.sharing.allowForks }
                  }))}
                >
                  {collaborationData.sharing.allowForks ? 'Enabled' : 'Disabled'}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>Share Link</Typography>
        <Card variant="outlined">
          <CardContent>
            <TextField
              fullWidth
              value={collaborationData.sharing.shareableLink}
              InputProps={{
                readOnly: true,
              }}
              variant="outlined"
              size="small"
            />
          </CardContent>
          <CardActions>
            <Button
              startIcon={<ShareIcon />}
              onClick={() => navigator.clipboard.writeText(collaborationData.sharing.shareableLink)}
            >
              Copy Link
            </Button>
            <Button startIcon={<ShareIcon />} variant="outlined">
              Share via Email
            </Button>
          </CardActions>
        </Card>
      </Box>
    </Stack>
  );

  if (!collaborationEnabled) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card sx={{ maxWidth: 400, textAlign: 'center' }}>
          <CardContent>
            <TeamIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Collaboration Features
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Enable collaboration to work with your team on CDS services. 
              Share, comment, and collaborate in real-time.
            </Typography>
            <Button
              variant="contained"
              startIcon={<TeamIcon />}
              onClick={() => onCollaborationToggle(true)}
            >
              Enable Collaboration
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', p: 2 }}>
      <Paper sx={{ height: '100%' }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<TeamIcon />} label="Team" />
          <Tab icon={<Badge badgeContent={collaborationData.comments.length} color="primary"><CommentIcon /></Badge>} label="Comments" />
          <Tab icon={<HistoryIcon />} label="Versions" />
          <Tab icon={<ShareIcon />} label="Sharing" />
        </Tabs>

        <Box sx={{ p: 2, height: 'calc(100% - 48px)', overflow: 'auto' }}>
          {activeTab === 0 && renderTeamTab()}
          {activeTab === 1 && renderCommentsTab()}
          {activeTab === 2 && renderVersionHistoryTab()}
          {activeTab === 3 && renderSharingTab()}
        </Box>
      </Paper>

      {/* Invite team member dialog */}
      <Dialog open={showInviteDialog} onClose={() => setShowInviteDialog(false)}>
        <DialogTitle>Invite Team Member</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
            <TextField
              label="Email Address"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                label="Role"
              >
                <MenuItem value="viewer">Viewer - Can view only</MenuItem>
                <MenuItem value="reviewer">Reviewer - Can comment and review</MenuItem>
                <MenuItem value="editor">Editor - Can edit and modify</MenuItem>
                <MenuItem value="admin">Admin - Full access</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInviteDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleInviteTeamMember}
            disabled={!inviteEmail.trim()}
          >
            Invite
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CollaborationPanel;