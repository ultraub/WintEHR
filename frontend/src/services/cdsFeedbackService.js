/**
 * CDS Feedback Service
 * Handles comprehensive feedback for CDS Hooks according to v2.0 specification
 */
import { cdsHooksClient } from './cdsHooksClient';
import { cdsLogger } from '../config/logging';

class CDSFeedbackService {
  /**
   * Send feedback for a card interaction
   * @param {Object} params - Feedback parameters
   * @param {string} params.serviceId - CDS service ID
   * @param {string} params.cardUuid - Card UUID
   * @param {string} params.outcome - 'accepted' or 'overridden'
   * @param {Array} params.acceptedSuggestions - Array of accepted suggestion UUIDs (if outcome is 'accepted')
   * @param {Object} params.overrideReason - Override reason object (if outcome is 'overridden')
   * @param {string} params.overrideReason.code - Reason code
   * @param {string} params.overrideReason.system - Code system
   * @param {string} params.overrideReason.display - Display text
   * @param {string} params.userComment - Optional user comment for override
   * @returns {Promise<boolean>} Success status
   */
  async sendFeedback({
    serviceId,
    cardUuid,
    outcome,
    acceptedSuggestions = [],
    overrideReason = null,
    userComment = null
  }) {
    try {
      // Validate required parameters
      if (!serviceId || !cardUuid || !outcome) {
        cdsLogger.error('Missing required feedback parameters', { serviceId, cardUuid, outcome });
        return false;
      }

      // Validate outcome value
      if (!['accepted', 'overridden'].includes(outcome)) {
        cdsLogger.error('Invalid outcome value', { outcome });
        return false;
      }

      // Build feedback object according to CDS Hooks spec
      const feedbackItem = {
        card: cardUuid,
        outcome: outcome,
        outcomeTimestamp: new Date().toISOString()
      };

      // Add accepted suggestions if outcome is 'accepted'
      if (outcome === 'accepted' && acceptedSuggestions.length > 0) {
        feedbackItem.acceptedSuggestions = acceptedSuggestions.map(suggestionId => ({
          id: suggestionId
        }));
      }

      // Add override reason if outcome is 'overridden'
      if (outcome === 'overridden' && overrideReason) {
        feedbackItem.overrideReason = {
          reason: {
            code: overrideReason.code,
            system: overrideReason.system,
            display: overrideReason.display
          }
        };

        // Add user comment if provided
        if (userComment && userComment.trim()) {
          feedbackItem.overrideReason.userComment = userComment.trim();
        }
      }

      // Create feedback request
      const feedbackRequest = {
        feedback: [feedbackItem]
      };

      cdsLogger.info('Sending CDS feedback', { 
        serviceId, 
        outcome, 
        feedbackRequest 
      });

      // Send feedback to CDS service
      const response = await cdsHooksClient.httpClient.post(
        `/cds-services/${serviceId}/feedback`,
        feedbackRequest
      );

      cdsLogger.info('CDS feedback sent successfully', { 
        serviceId, 
        outcome,
        response: response.data 
      });

      return true;
    } catch (error) {
      cdsLogger.error('Failed to send CDS feedback', {
        serviceId,
        cardUuid,
        outcome,
        error: error.message
      });
      // Don't throw - feedback failures shouldn't disrupt user experience
      return false;
    }
  }

  /**
   * Send bulk feedback for multiple card interactions
   * @param {Array} feedbackItems - Array of feedback items
   * @returns {Promise<Object>} Results object with success/failure counts
   */
  async sendBulkFeedback(feedbackItems) {
    const results = {
      successful: 0,
      failed: 0,
      details: []
    };

    for (const item of feedbackItems) {
      const success = await this.sendFeedback(item);
      if (success) {
        results.successful++;
      } else {
        results.failed++;
      }
      results.details.push({
        cardUuid: item.cardUuid,
        outcome: item.outcome,
        success
      });
    }

    cdsLogger.info('Bulk feedback results', results);
    return results;
  }

  /**
   * Helper to create override feedback
   * @param {Object} params - Override parameters
   * @returns {Promise<boolean>} Success status
   */
  async sendOverrideFeedback(serviceId, cardUuid, reasonCode, userComment = null) {
    // Find the reason object from code
    const overrideReason = this.getOverrideReasonByCode(reasonCode);
    if (!overrideReason) {
      cdsLogger.error('Invalid override reason code', { reasonCode });
      return false;
    }

    return this.sendFeedback({
      serviceId,
      cardUuid,
      outcome: 'overridden',
      overrideReason,
      userComment
    });
  }

  /**
   * Helper to create acceptance feedback
   * @param {Object} params - Acceptance parameters
   * @returns {Promise<boolean>} Success status
   */
  async sendAcceptanceFeedback(serviceId, cardUuid, acceptedSuggestionIds) {
    return this.sendFeedback({
      serviceId,
      cardUuid,
      outcome: 'accepted',
      acceptedSuggestions: acceptedSuggestionIds
    });
  }

  /**
   * Get override reason object by code
   * @param {string} code - Reason code
   * @returns {Object|null} Override reason object
   */
  getOverrideReasonByCode(code) {
    // Import OVERRIDE_REASONS from CDSPresentation component
    const OVERRIDE_REASONS = {
      'patient-preference': {
        code: 'patient-preference',
        system: 'https://winterhr.com/cds-hooks/override-reasons',
        display: 'Patient preference or contraindication'
      },
      'clinical-judgment': {
        code: 'clinical-judgment',
        system: 'https://winterhr.com/cds-hooks/override-reasons',
        display: 'Clinical judgment based on patient context'
      },
      'alternative-treatment': {
        code: 'alternative-treatment',
        system: 'https://winterhr.com/cds-hooks/override-reasons',
        display: 'Alternative treatment selected'
      },
      'risk-benefit': {
        code: 'risk-benefit',
        system: 'https://winterhr.com/cds-hooks/override-reasons',
        display: 'Risk-benefit analysis favors override'
      },
      'false-positive': {
        code: 'false-positive',
        system: 'https://winterhr.com/cds-hooks/override-reasons',
        display: 'Alert appears to be false positive'
      },
      'not-applicable': {
        code: 'not-applicable',
        system: 'https://winterhr.com/cds-hooks/override-reasons',
        display: 'Alert not applicable to this patient'
      },
      'emergency': {
        code: 'emergency',
        system: 'https://winterhr.com/cds-hooks/override-reasons',
        display: 'Emergency situation requires override'
      },
      'other': {
        code: 'other',
        system: 'https://winterhr.com/cds-hooks/override-reasons',
        display: 'Other reason (see comments)'
      }
    };

    return OVERRIDE_REASONS[code] || null;
  }

  /**
   * Track feedback metrics for analytics
   * @param {Object} feedback - Feedback data
   */
  trackFeedbackMetrics(feedback) {
    try {
      // Track in analytics if available
      if (window.analytics && window.analytics.track) {
        window.analytics.track('cds_feedback_sent', {
          serviceId: feedback.serviceId,
          outcome: feedback.outcome,
          cardIndicator: feedback.cardIndicator,
          hasUserComment: !!feedback.userComment,
          overrideReasonCode: feedback.overrideReason?.code,
          acceptedSuggestionsCount: feedback.acceptedSuggestions?.length || 0,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      cdsLogger.error('Failed to track feedback metrics', error);
    }
  }
}

// Export singleton instance
export const cdsFeedbackService = new CDSFeedbackService();

// Also export class for testing
export default CDSFeedbackService;