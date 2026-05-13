/**
 * LabOrderTab — pre-configures OrderEntryForm with category='laboratory'.
 * Thin shim by design: tabs differ only in catalog source + category
 * coding; the form itself is shared.
 */
import React from 'react';
import OrderEntryForm from '../OrderEntryForm';

const LabOrderTab = () => <OrderEntryForm category="laboratory" kindLabel="lab tests" />;

export default LabOrderTab;
