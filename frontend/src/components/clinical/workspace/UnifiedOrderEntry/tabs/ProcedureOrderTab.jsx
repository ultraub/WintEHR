/**
 * ProcedureOrderTab — pre-configures OrderEntryForm with
 * category='procedure'. Catalog search for procedures (SNOMED CT
 * mostly) arrives in Phase 4.1.B; this MVP defers to the legacy CPOE
 * dialog with an info banner.
 */
import React from 'react';
import OrderEntryForm from '../OrderEntryForm';

const ProcedureOrderTab = () => <OrderEntryForm category="procedure" kindLabel="procedures" />;

export default ProcedureOrderTab;
