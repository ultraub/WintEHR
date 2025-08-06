/**
 * OrderDialogWrapper Component
 * Wrapper that provides both standard and wizard modes for placing orders
 * 
 * @since 2025-01-21
 */
import React from 'react';
import OrderDialog from './OrderDialog';
import OrderDialogWizard from './OrderDialogWizard';

const OrderDialogWrapper = ({
  wizardMode = true, // Default to wizard mode for better UX
  ...props
}) => {
  if (wizardMode) {
    return <OrderDialogWizard {...props} />;
  }
  
  return <OrderDialog {...props} />;
};

export default OrderDialogWrapper;