#!/usr/bin/env python3
"""Generate sample DiagnosticReport resources for existing ImagingStudy resources."""

import asyncio
import asyncpg
import json
import uuid
from datetime import datetime, timedelta
import random

# Sample report templates based on modality and body site
REPORT_TEMPLATES = {
    'CT_CHEST': {
        'findings': [
            "Lungs are clear bilaterally without evidence of consolidation, mass, or pleural effusion. "
            "No significant mediastinal, hilar, or axillary lymphadenopathy is identified. "
            "Heart size is within normal limits. Great vessels appear normal. "
            "Visualized portions of the upper abdomen are unremarkable.",
            
            "Mild bibasilar atelectasis is present. No consolidation or pleural effusion. "
            "Mediastinal and hilar contours are within normal limits. "
            "Cardiac silhouette is normal in size. No pericardial effusion. "
            "Osseous structures demonstrate no acute abnormality.",
            
            "Small right pleural effusion with associated compressive atelectasis. "
            "No pneumothorax. Mediastinal structures are midline. "
            "Mild cardiomegaly without pericardial effusion. "
            "Degenerative changes of the thoracic spine."
        ],
        'impressions': [
            "No acute cardiopulmonary abnormality.",
            "Mild bibasilar atelectasis without acute pulmonary process.",
            "Small right pleural effusion with associated atelectasis. Clinical correlation recommended."
        ],
        'recommendations': [
            "",
            "Follow-up chest x-ray in 4-6 weeks if clinically indicated.",
            "Consider follow-up imaging after treatment to assess for resolution."
        ]
    },
    'CT_HEAD': {
        'findings': [
            "No acute intracranial hemorrhage, mass effect, or midline shift. "
            "Ventricles and sulci are normal in size and configuration for age. "
            "Gray-white matter differentiation is preserved. "
            "Visualized paranasal sinuses and mastoid air cells are clear.",
            
            "No evidence of acute intracranial abnormality. "
            "Mild age-related involutional changes with prominence of ventricles and sulci. "
            "Small vessel ischemic changes in the periventricular white matter. "
            "Maxillary sinus mucosal thickening, likely inflammatory.",
            
            "No acute hemorrhage or territorial infarct. "
            "Chronic microvascular ischemic changes. "
            "Mild generalized cerebral volume loss appropriate for age. "
            "Old lacunar infarct in right basal ganglia."
        ],
        'impressions': [
            "No acute intracranial abnormality.",
            "Age-related changes without acute findings. Mild sinusitis.",
            "Chronic small vessel disease. No acute intracranial process."
        ],
        'recommendations': [
            "",
            "ENT evaluation for sinus disease if clinically indicated.",
            "MRI for further evaluation if clinical concern persists."
        ]
    },
    'MR_BRAIN': {
        'findings': [
            "No restricted diffusion to suggest acute infarct. "
            "No intracranial hemorrhage or mass lesion. "
            "Ventricles and sulci are normal in size. "
            "No abnormal enhancement following contrast administration. "
            "Flow voids are preserved in major intracranial vessels.",
            
            "Scattered T2/FLAIR hyperintense foci in the periventricular and subcortical white matter, "
            "consistent with chronic small vessel ischemic changes. "
            "No acute infarct on diffusion-weighted imaging. "
            "No intracranial mass or abnormal enhancement. "
            "Mild mucosal thickening in the ethmoid sinuses."
        ],
        'impressions': [
            "Normal MRI of the brain.",
            "Chronic microvascular ischemic changes. No acute intracranial abnormality."
        ],
        'recommendations': [
            "",
            "Clinical correlation. Consider vascular risk factor modification."
        ]
    },
    'XR_CHEST': {
        'findings': [
            "Lungs are clear. No focal consolidation, pleural effusion, or pneumothorax. "
            "Cardiac silhouette is normal in size. Mediastinal contours are unremarkable. "
            "No acute osseous abnormality.",
            
            "Mild cardiomegaly. Clear lungs without infiltrate or effusion. "
            "No pneumothorax. Degenerative changes of the spine.",
            
            "Patchy opacity in the right lower lobe, possibly atelectasis versus infiltrate. "
            "No pleural effusion or pneumothorax. Heart size upper limits of normal."
        ],
        'impressions': [
            "No acute cardiopulmonary process.",
            "Cardiomegaly without acute pulmonary disease.",
            "Right lower lobe opacity. Pneumonia cannot be excluded. Clinical correlation recommended."
        ],
        'recommendations': [
            "",
            "Clinical correlation with cardiovascular risk factors.",
            "Follow-up radiograph after treatment to document resolution."
        ]
    },
    'US_ABDOMEN': {
        'findings': [
            "Liver is normal in size and echogenicity. No focal hepatic lesion. "
            "Gallbladder is normal without stones or wall thickening. "
            "Common bile duct measures 3 mm. Pancreas is obscured by bowel gas. "
            "Kidneys are normal in size and echogenicity without hydronephrosis. "
            "Spleen is normal. No free fluid.",
            
            "Mild hepatomegaly with increased echogenicity suggesting fatty infiltration. "
            "No focal liver lesion. Gallbladder contains sludge without stones. "
            "Bilateral kidneys appear normal. Limited evaluation of pancreas due to bowel gas."
        ],
        'impressions': [
            "Normal abdominal ultrasound.",
            "Hepatic steatosis. Gallbladder sludge without acute cholecystitis."
        ],
        'recommendations': [
            "",
            "Clinical correlation. Consider hepatic panel and lifestyle modifications."
        ]
    }
}

async def generate_imaging_reports():
    """Generate DiagnosticReport resources for existing ImagingStudy resources."""
    conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
    
    try:
        # Get all imaging studies
        studies = await conn.fetch("""
            SELECT id, fhir_id, resource
            FROM fhir.resources
            WHERE resource_type = 'ImagingStudy'
            AND deleted = false
            ORDER BY last_updated DESC
        """)
        
        print(f"Found {len(studies)} imaging studies")
        
        # Check for existing diagnostic reports
        existing_reports = await conn.fetch("""
            SELECT resource
            FROM fhir.resources
            WHERE resource_type = 'DiagnosticReport'
            AND deleted = false
        """)
        
        # Extract ImagingStudy references from existing reports
        existing_study_refs = set()
        for report_row in existing_reports:
            report = json.loads(report_row['resource'])
            based_on = report.get('basedOn', [])
            for ref in based_on:
                if 'ImagingStudy' in ref.get('reference', ''):
                    existing_study_refs.add(ref['reference'])
        
        print(f"Found {len(existing_reports)} existing diagnostic reports")
        
        reports_created = 0
        
        for study_row in studies:
            study = json.loads(study_row['resource'])
            study_ref = f"ImagingStudy/{study['id']}"
            
            # Skip if report already exists
            if study_ref in existing_study_refs:
                print(f"Report already exists for {study['id']}")
                continue
            
            # Determine report template based on study type
            modality = study.get('modality', [{}])[0].get('code', 'CT')
            description = study.get('description', '').upper()
            
            # Determine template key
            template_key = None
            if modality == 'CT' and 'CHEST' in description:
                template_key = 'CT_CHEST'
            elif modality == 'CT' and 'HEAD' in description:
                template_key = 'CT_HEAD'
            elif modality == 'MR' and 'BRAIN' in description:
                template_key = 'MR_BRAIN'
            elif modality in ['CR', 'DX'] and 'CHEST' in description:
                template_key = 'XR_CHEST'
            elif modality == 'US':
                template_key = 'US_ABDOMEN'
            else:
                # Default based on modality
                template_key = {
                    'CT': 'CT_CHEST',
                    'MR': 'MR_BRAIN',
                    'CR': 'XR_CHEST',
                    'DX': 'XR_CHEST',
                    'US': 'US_ABDOMEN'
                }.get(modality, 'CT_CHEST')
            
            template = REPORT_TEMPLATES.get(template_key, REPORT_TEMPLATES['CT_CHEST'])
            
            # Randomly select findings, impression, and recommendations
            findings = random.choice(template['findings'])
            impression = random.choice(template['impressions'])
            recommendation = random.choice(template['recommendations'])
            
            # Create DiagnosticReport
            report_id = str(uuid.uuid4())
            study_date = study.get('started', study.get('performedDateTime', datetime.now().isoformat()))
            
            # Report is typically available 1-4 hours after study
            report_time = datetime.fromisoformat(study_date.replace('Z', '+00:00')) + timedelta(hours=random.randint(1, 4))
            
            diagnostic_report = {
                'resourceType': 'DiagnosticReport',
                'id': report_id,
                'status': 'final',
                'code': {
                    'coding': [{
                        'system': 'http://loinc.org',
                        'code': '18748-4',
                        'display': 'Diagnostic Imaging Report'
                    }],
                    'text': f"{modality} Report - {study.get('description', 'Imaging Study')}"
                },
                'subject': study.get('subject'),
                'effectiveDateTime': study_date,
                'issued': report_time.isoformat() + 'Z',
                'basedOn': [{
                    'reference': study_ref,
                    'display': study.get('description', 'Imaging Study')
                }],
                'conclusion': impression,
                'presentedForm': [{
                    'contentType': 'text/plain',
                    'data': findings.encode('utf-8').hex(),  # Store as hex-encoded string
                    'title': 'Detailed Findings'
                }]
            }
            
            # Add recommendations if present
            if recommendation:
                diagnostic_report['conclusionCode'] = [{
                    'text': recommendation
                }]
            
            # Insert the report
            await conn.execute("""
                INSERT INTO fhir.resources (
                    fhir_id, resource_type, resource, version_id, 
                    last_updated
                ) VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
            """, report_id, 'DiagnosticReport', json.dumps(diagnostic_report))
            
            reports_created += 1
            print(f"Created report for {study['id']} ({modality} - {description})")
        
        print(f"\nSuccessfully created {reports_created} diagnostic reports")
        
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(generate_imaging_reports())