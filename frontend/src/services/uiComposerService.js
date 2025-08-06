/**
 * UI Composer Service
 * Handles communication with the backend UI Composer API
 */

class UIComposerService {
  constructor() {
    this.baseUrl = '/api/ui-composer';
    this.sessionId = null;
  }

  /**
   * Set session ID for conversation continuity
   */
  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  /**
   * Get current session ID
   */
  getSessionId() {
    return this.sessionId;
  }

  /**
   * Test if Claude CLI is available on the backend
   */
  async testClaude() {
    try {
      const response = await fetch(`${this.baseUrl}/test-claude`);
      const data = await response.json();
      return data;
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze natural language UI request
   */
  async analyzeRequest(request, context = {}, method = null) {
    try {
      const response = await fetch(`${this.baseUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          request,
          context,
          session_id: this.sessionId,
          method
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to analyze request');
      }

      const data = await response.json();
      
      // Update session ID if returned
      if (data.session_id) {
        this.sessionId = data.session_id;
      }

      return data;
    } catch (error) {
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  /**
   * Generate UI components from specification
   */
  async generateUI(specification, progressive = true, method = null) {
    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          specification,
          session_id: this.sessionId,
          progressive,
          method
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate UI');
      }

      const data = await response.json();
      
      // Update session ID if returned
      if (data.session_id) {
        this.sessionId = data.session_id;
      }

      return data;
    } catch (error) {
      throw new Error(`Generation failed: ${error.message}`);
    }
  }

  /**
   * Refine UI based on user feedback
   */
  async refineUI(feedback, specification, feedbackType = 'general', selectedComponent = null, method = null) {
    try {
      const response = await fetch(`${this.baseUrl}/refine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          feedback,
          feedback_type: feedbackType,
          specification,
          selected_component: selectedComponent,
          session_id: this.sessionId,
          method
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to refine UI');
      }

      const data = await response.json();
      
      // Update session ID if returned
      if (data.session_id) {
        this.sessionId = data.session_id;
      }

      return data;
    } catch (error) {
      throw new Error(`Refinement failed: ${error.message}`);
    }
  }

  /**
   * Save dashboard specification
   */
  async saveDashboard(name, description, specification, metadata = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          name,
          description,
          specification,
          metadata
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save dashboard');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(`Save failed: ${error.message}`);
    }
  }

  /**
   * Get session information
   */
  async getSession(sessionId) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get session');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(`Get session failed: ${error.message}`);
    }
  }

  /**
   * Create a new session
   */
  createNewSession() {
    this.sessionId = null;
    return this.sessionId;
  }

  /**
   * Check if backend service is available
   */
  async isAvailable() {
    try {
      const result = await this.testClaude();
      return result.available === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get service status including Claude availability
   */
  async getStatus() {
    try {
      const claudeTest = await this.testClaude();
      return {
        serviceAvailable: true,
        claudeAvailable: claudeTest.available,
        claudePath: claudeTest.path,
        claudeVersion: claudeTest.version,
        error: claudeTest.error,
        method_status: claudeTest.method_status
      };
    } catch (error) {
      return {
        serviceAvailable: false,
        claudeAvailable: false,
        error: error.message,
        method_status: {}
      };
    }
  }

  /**
   * Get cost information for a session
   */
  async getSessionCost(sessionId) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/cost`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get session cost');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(`Get session cost failed: ${error.message}`);
    }
  }
}

// Export singleton instance
export const uiComposerService = new UIComposerService();

// Also export class for testing
export default UIComposerService;