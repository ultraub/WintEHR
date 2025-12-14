-- Sample CDS Visual Builder Services

-- 1. A1C Monitoring for Diabetic Patients
INSERT INTO cds_visual_builder.service_configs (
    service_id, name, description, service_type, category, hook_type,
    conditions, card_config, display_config, prefetch_config,
    status, version, created_by
) VALUES (
    'a1c-monitoring-reminder',
    'A1C Monitoring Reminder',
    'Reminds providers when diabetic patients are due for A1C testing',
    'reminder',
    'chronic_disease',
    'patient-view',
    '[{"field": "condition.code", "operator": "contains", "value": "diabetes"}]'::jsonb,
    '{"summary": "A1C Test Due", "detail": "Patient with diabetes has not had A1C checked in over 3 months", "indicator": "warning"}'::jsonb,
    '{"icon": "lab", "priority": "medium", "dismissible": true}'::jsonb,
    '{"patient": "Patient/{{context.patientId}}"}'::jsonb,
    'ACTIVE', 1, 'system'
);

-- 2. Flu Vaccination Reminder
INSERT INTO cds_visual_builder.service_configs (
    service_id, name, description, service_type, category, hook_type,
    conditions, card_config, display_config, prefetch_config,
    status, version, created_by
) VALUES (
    'flu-vaccination-reminder',
    'Influenza Vaccination Reminder',
    'Reminds providers to offer flu vaccination during flu season',
    'reminder',
    'preventive_care',
    'patient-view',
    '[{"field": "immunization.fluVaccine", "operator": "not_within", "value": "365 days"}]'::jsonb,
    '{"summary": "Flu Vaccine Recommended", "detail": "Patient has not received influenza vaccination this season", "indicator": "info"}'::jsonb,
    '{"icon": "vaccine", "priority": "low", "dismissible": true}'::jsonb,
    '{"patient": "Patient/{{context.patientId}}"}'::jsonb,
    'ACTIVE', 1, 'system'
);

-- 3. High-Risk Medication Alert
INSERT INTO cds_visual_builder.service_configs (
    service_id, name, description, service_type, category, hook_type,
    conditions, card_config, display_config, prefetch_config,
    status, version, created_by
) VALUES (
    'high-risk-medication-alert',
    'High-Risk Medication Alert',
    'Alerts when prescribing high-risk medications to elderly patients',
    'alert',
    'medication_safety',
    'order-select',
    '[{"field": "patient.age", "operator": ">=", "value": "65"}]'::jsonb,
    '{"summary": "High-Risk Medication for Elderly", "detail": "This medication is on the Beers Criteria list", "indicator": "critical"}'::jsonb,
    '{"icon": "warning", "priority": "high", "dismissible": false}'::jsonb,
    '{"patient": "Patient/{{context.patientId}}"}'::jsonb,
    'ACTIVE', 1, 'system'
);

-- 4. Blood Pressure Follow-up
INSERT INTO cds_visual_builder.service_configs (
    service_id, name, description, service_type, category, hook_type,
    conditions, card_config, display_config, prefetch_config,
    status, version, created_by
) VALUES (
    'bp-followup-reminder',
    'Blood Pressure Follow-up Reminder',
    'Reminds providers to schedule follow-up for elevated BP',
    'reminder',
    'chronic_disease',
    'patient-view',
    '[{"field": "observation.systolic", "operator": ">=", "value": "140"}]'::jsonb,
    '{"summary": "Elevated BP - Follow-up Recommended", "detail": "Patient has recent elevated blood pressure readings", "indicator": "warning"}'::jsonb,
    '{"icon": "heart", "priority": "medium", "dismissible": true}'::jsonb,
    '{"patient": "Patient/{{context.patientId}}"}'::jsonb,
    'ACTIVE', 1, 'system'
);

-- 5. Cancer Screening Reminder
INSERT INTO cds_visual_builder.service_configs (
    service_id, name, description, service_type, category, hook_type,
    conditions, card_config, display_config, prefetch_config,
    status, version, created_by
) VALUES (
    'colorectal-screening-visual',
    'Colorectal Cancer Screening Reminder',
    'Reminds providers about colorectal cancer screening for patients 45-75',
    'reminder',
    'preventive_care',
    'patient-view',
    '[{"field": "patient.age", "operator": "between", "value": ["45", "75"]}]'::jsonb,
    '{"summary": "Colorectal Cancer Screening Due", "detail": "Patient is due for colorectal cancer screening", "indicator": "info"}'::jsonb,
    '{"icon": "screening", "priority": "medium", "dismissible": true}'::jsonb,
    '{"patient": "Patient/{{context.patientId}}"}'::jsonb,
    'ACTIVE', 1, 'system'
);

-- 6. Opioid Prescribing Alert
INSERT INTO cds_visual_builder.service_configs (
    service_id, name, description, service_type, category, hook_type,
    conditions, card_config, display_config, prefetch_config,
    status, version, created_by
) VALUES (
    'opioid-prescribing-alert',
    'Opioid Prescribing Safety Alert',
    'Provides guidance when prescribing opioids',
    'alert',
    'medication_safety',
    'order-sign',
    '[{"field": "medication.class", "operator": "equals", "value": "opioid"}]'::jsonb,
    '{"summary": "Opioid Prescribing - Safety Check", "detail": "Check PDMP and review patient risk factors before prescribing", "indicator": "warning"}'::jsonb,
    '{"icon": "alert", "priority": "high", "dismissible": false}'::jsonb,
    '{"patient": "Patient/{{context.patientId}}"}'::jsonb,
    'ACTIVE', 1, 'system'
);
