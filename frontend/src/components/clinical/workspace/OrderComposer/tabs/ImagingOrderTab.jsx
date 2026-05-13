/**
 * ImagingOrderTab — pre-configures OrderEntryForm with category='imaging'.
 * Catalog search for imaging studies arrives in Phase 4.1.B; this MVP
 * shows the form with an info banner pointing users at the legacy CPOE
 * dialog for now.
 */
import React from 'react';
import OrderEntryForm from '../OrderEntryForm';

const ImagingOrderTab = () => <OrderEntryForm category="imaging" kindLabel="imaging studies" />;

export default ImagingOrderTab;
