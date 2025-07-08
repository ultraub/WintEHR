/**
 * Logging Configuration
 * Controls logging levels for different parts of the application
 */

// Environment-based logging configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Global logging configuration
export const LOGGING_CONFIG = {
  // Overall logging level
  level: isDevelopment ? 'debug' : 'warn',
  
  // Module-specific logging
  modules: {
    cdsHooks: {
      enabled: isDevelopment,
      level: 'debug', // debug, info, warn, error
      console: true,
      remote: false
    },
    fhirService: {
      enabled: isDevelopment,
      level: 'info',
      console: true,
      remote: false
    },
    authentication: {
      enabled: true,
      level: 'warn',
      console: true,
      remote: isProduction
    },
    api: {
      enabled: isDevelopment,
      level: 'info',
      console: true,
      remote: false
    }
  },
  
  // Console styling
  styles: {
    debug: 'color: #888; font-style: italic;',
    info: 'color: #007bff;',
    warn: 'color: #ffc107; font-weight: bold;',
    error: 'color: #dc3545; font-weight: bold;'
  }
};

// Logging utility functions
export class Logger {
  constructor(module = 'default') {
    this.module = module;
    this.config = LOGGING_CONFIG.modules[module] || {
      enabled: isDevelopment,
      level: 'info',
      console: true,
      remote: false
    };
  }

  shouldLog(level) {
    if (!this.config.enabled) return false;
    
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const requestedLevelIndex = levels.indexOf(level);
    
    return requestedLevelIndex >= currentLevelIndex;
  }

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.module.toUpperCase()}] [${level.toUpperCase()}]`;
    return [prefix, message, ...args];
  }

  debug(message, ...args) {
    if (this.shouldLog('debug') && this.config.console) {
      );
    }
  }

  info(message, ...args) {
    if (this.shouldLog('info') && this.config.console) {
      );
    }
  }

  warn(message, ...args) {
    if (this.shouldLog('warn') && this.config.console) {
      );
    }
  }

  error(message, ...args) {
    if (this.shouldLog('error') && this.config.console) {
      );
    }
  }

  // Group logging for related operations
  group(label, level = 'info') {
    if (this.shouldLog(level) && this.config.console) {
      console.group(...this.formatMessage(level, label));
    }
  }

  groupEnd() {
    if (this.config.console) {
      console.groupEnd();
    }
  }

  // Performance timing
  time(label) {
    if (this.config.console) {
      console.time(`${this.module}: ${label}`);
    }
  }

  timeEnd(label) {
    if (this.config.console) {
      console.timeEnd(`${this.module}: ${label}`);
    }
  }
}

// Create module-specific loggers
export const cdsLogger = new Logger('cdsHooks');
export const fhirLogger = new Logger('fhirService');
export const authLogger = new Logger('authentication');
export const apiLogger = new Logger('api');

// Utility function to create custom loggers
export const createLogger = (module) => new Logger(module);

// Development helpers
export const devLog = (...args) => {
  if (isDevelopment) {
    
  }
};

export const prodLog = (...args) => {
  if (isProduction) {
    
  }
};

// Export configuration for external use
export default LOGGING_CONFIG;