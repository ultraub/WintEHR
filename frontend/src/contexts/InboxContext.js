/**
 * Inbox Context Provider
 * Manages clinical inbox messages using FHIR Communication resources
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { fhirClient } from '../services/fhirClient';
import { useAuth } from './AuthContext';

const InboxContext = createContext(undefined);

export const useInbox = () => {
  const context = useContext(InboxContext);
  if (!context) {
    throw new Error('useInbox must be used within an InboxProvider');
  }
  return context;
};

export const InboxProvider = ({ children }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    priority: {
      routine: 0,
      urgent: 0,
      asap: 0,
      stat: 0
    },
    category: {
      notification: 0,
      alert: 0,
      reminder: 0,
      instruction: 0
    }
  });

  // Transform FHIR Communication to internal message format
  const transformFHIRCommunication = (communication) => {
    return {
      id: communication.id,
      status: communication.status,
      priority: communication.priority || 'routine',
      category: communication.category?.[0]?.coding?.[0]?.code || 'notification',
      subject: communication.subject?.reference?.split('/')[1], // Patient ID
      topic: communication.topic?.text || communication.reasonCode?.[0]?.text || 'Clinical Message',
      sender: communication.sender?.reference?.split('/')[1],
      senderType: communication.sender?.reference?.split('/')[0],
      recipient: communication.recipient?.[0]?.reference?.split('/')[1],
      recipientType: communication.recipient?.[0]?.reference?.split('/')[0],
      sent: communication.sent,
      received: communication.received,
      payload: communication.payload?.map(p => ({
        content: p.contentString || p.contentReference?.display,
        attachment: p.contentAttachment
      })) || [],
      note: communication.note?.[0]?.text,
      isRead: communication.status === 'completed',
      encounter: communication.encounter?.reference?.split('/')[1],
      basedOn: communication.basedOn?.map(ref => ({
        type: ref.reference?.split('/')[0],
        id: ref.reference?.split('/')[1]
      })) || []
    };
  };

  // Load inbox messages
  const loadInboxItems = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const searchParams = {
        recipient: `Practitioner/${user?.id || user?.practitioner_id}`,
        _sort: '-sent',
        _count: filters.limit || 50
      };

      // Apply filters
      if (filters.status) {
        searchParams.status = filters.status;
      }
      if (filters.priority) {
        searchParams.priority = filters.priority;
      }
      if (filters.category) {
        searchParams.category = filters.category;
      }
      if (filters.unread) {
        searchParams.status = 'preparation,in-progress';
      }
      if (filters.patient_id) {
        searchParams.subject = `Patient/${filters.patient_id}`;
      }
      if (filters.sent_after) {
        searchParams.sent = `ge${filters.sent_after}`;
      }

      const result = await fhirClient.search('Communication', searchParams);
      
      if (result.resources) {
        const transformedMessages = result.resources.map(transformFHIRCommunication);
        setMessages(transformedMessages);
        
        // Calculate stats
        calculateStats(transformedMessages);
      }
    } catch (err) {
      
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Calculate inbox statistics
  const calculateStats = (messageList) => {
    const newStats = {
      total: messageList.length,
      unread: 0,
      priority: {
        routine: 0,
        urgent: 0,
        asap: 0,
        stat: 0
      },
      category: {
        notification: 0,
        alert: 0,
        reminder: 0,
        instruction: 0
      }
    };

    messageList.forEach(msg => {
      if (!msg.isRead) {
        newStats.unread++;
      }
      
      // Count by priority
      const priority = msg.priority || 'routine';
      if (newStats.priority[priority] !== undefined) {
        newStats.priority[priority]++;
      }
      
      // Count by category
      const category = msg.category || 'notification';
      if (newStats.category[category] !== undefined) {
        newStats.category[category]++;
      }
    });

    setStats(newStats);
    setUnreadCount(newStats.unread);
  };

  // Load inbox stats only
  const loadInboxStats = useCallback(async () => {
    try {
      // Get counts for different statuses
      const searchParams = {
        recipient: `Practitioner/${user?.id || user?.practitioner_id}`,
        _summary: 'count'
      };

      const [totalResult, unreadResult] = await Promise.all([
        fhirClient.search('Communication', searchParams),
        fhirClient.search('Communication', {
          ...searchParams,
          status: 'preparation,in-progress'
        })
      ]);

      setStats(prev => ({
        ...prev,
        total: totalResult.total || 0,
        unread: unreadResult.total || 0
      }));
      setUnreadCount(unreadResult.total || 0);
    } catch (err) {
      
    }
  }, [user]);

  // Mark message as read
  const markInboxItemRead = useCallback(async (messageId) => {
    try {
      // Get the communication resource
      const communication = await fhirClient.read('Communication', messageId);
      
      // Update status to completed (read)
      communication.status = 'completed';
      communication.received = communication.received || new Date().toISOString();
      
      // Update the resource
      await fhirClient.update('Communication', messageId, communication);
      
      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, isRead: true, status: 'completed' } : msg
      ));
      
      // Update stats
      setUnreadCount(prev => Math.max(0, prev - 1));
      setStats(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1)
      }));
    } catch (err) {
      
      throw err;
    }
  }, []);

  // Bulk acknowledge messages
  const acknowledgeInboxItems = useCallback(async (messageIds) => {
    try {
      // Update each message
      await Promise.all(messageIds.map(async (id) => {
        const communication = await fhirClient.read('Communication', id);
        communication.status = 'completed';
        communication.received = communication.received || new Date().toISOString();
        await fhirClient.update('Communication', id, communication);
      }));
      
      // Reload messages
      await loadInboxItems();
    } catch (err) {
      
      throw err;
    }
  }, [loadInboxItems]);

  // Forward messages
  const forwardInboxItems = useCallback(async (messageIds, recipientId, note) => {
    try {
      await Promise.all(messageIds.map(async (id) => {
        // Get original message
        const original = await fhirClient.read('Communication', id);
        
        // Create new forwarded message
        const forwarded = {
          resourceType: 'Communication',
          status: 'preparation',
          priority: original.priority,
          category: original.category,
          subject: original.subject,
          topic: {
            text: `Fwd: ${original.topic?.text || 'Clinical Message'}`
          },
          sender: {
            reference: `Practitioner/${user?.id || user?.practitioner_id}`
          },
          recipient: [{
            reference: `Practitioner/${recipientId}`
          }],
          sent: new Date().toISOString(),
          payload: original.payload,
          note: [{
            text: note || 'Forwarded message'
          }],
          basedOn: [{
            reference: `Communication/${id}`
          }]
        };
        
        await fhirClient.create('Communication', forwarded);
      }));
      
      // Reload messages
      await loadInboxItems();
    } catch (err) {
      
      throw err;
    }
  }, [user, loadInboxItems]);

  // Create a new message
  const createMessage = useCallback(async (messageData) => {
    try {
      const communication = {
        resourceType: 'Communication',
        status: 'preparation',
        priority: messageData.priority || 'routine',
        category: [{
          coding: [{
            system: 'http://wintehr.com/communication-category',
            code: messageData.category || 'notification',
            display: messageData.categoryDisplay || 'Notification'
          }]
        }],
        subject: messageData.patientId ? {
          reference: `Patient/${messageData.patientId}`
        } : undefined,
        topic: {
          text: messageData.topic || messageData.subject
        },
        sender: {
          reference: `Practitioner/${user?.id || user?.practitioner_id}`
        },
        recipient: messageData.recipients?.map(r => ({
          reference: `Practitioner/${r}`
        })) || [],
        sent: new Date().toISOString(),
        payload: messageData.content ? [{
          contentString: messageData.content
        }] : [],
        encounter: messageData.encounterId ? {
          reference: `Encounter/${messageData.encounterId}`
        } : undefined,
        reasonCode: messageData.reason ? [{
          text: messageData.reason
        }] : undefined
      };

      const result = await fhirClient.create('Communication', communication);
      
      // Reload if the current user is a recipient
      if (messageData.recipients?.includes(user?.id || user?.practitioner_id)) {
        await loadInboxItems();
      }
      
      return result;
    } catch (err) {
      
      throw err;
    }
  }, [user, loadInboxItems]);

  // Auto-load on mount and user change
  useEffect(() => {
    if (user) {
      loadInboxStats();
    }
  }, [user, loadInboxStats]);

  const value = {
    messages,
    unreadCount,
    loading,
    error,
    stats,
    loadInboxItems,
    loadInboxStats,
    markInboxItemRead,
    acknowledgeInboxItems,
    forwardInboxItems,
    createMessage
  };

  return (
    <InboxContext.Provider value={value}>
      {children}
    </InboxContext.Provider>
  );
};