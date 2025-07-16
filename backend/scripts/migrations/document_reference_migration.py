#!/usr/bin/env python3
"""
DocumentReference Data Migration Script

This script identifies and fixes malformed DocumentReference records in the database.
It addresses common issues found in clinical documentation data.

Usage:
    python scripts/document_reference_migration.py --check      # Check for issues only
    python scripts/document_reference_migration.py --fix       # Fix issues
    python scripts/document_reference_migration.py --validate  # Validate after fixes
"""

import os
import sys
import argparse
import json
import base64
import logging
from typing import Dict, Any, List, Tuple
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import get_database_url
from fhir.core.converters.resource_specific.document_reference import DocumentReferenceConverter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('document_migration.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class DocumentReferenceMigrator:
    """Handles migration and validation of DocumentReference resources"""
    
    def __init__(self, database_url: str):
        self.engine = create_engine(database_url)
        self.Session = sessionmaker(bind=self.engine)
        self.issues_found = []
        self.fixes_applied = []
        
    def analyze_database(self) -> Dict[str, Any]:
        """Analyze DocumentReference records in the database"""
        logger.info("Starting database analysis...")
        
        with self.Session() as session:
            # Get all DocumentReference records
            result = session.execute(text("""
                SELECT id, resource_type, data 
                FROM fhir_resources 
                WHERE resource_type = 'DocumentReference'
                ORDER BY id
            """))
            
            total_docs = 0
            valid_docs = 0
            malformed_docs = 0
            issues_by_type = {}
            
            for row in result:
                total_docs += 1
                doc_id = row.id
                data = row.data
                
                try:
                    issues = self._analyze_document(doc_id, data)
                    
                    if issues:
                        malformed_docs += 1
                        self.issues_found.extend(issues)
                        
                        # Categorize issues
                        for issue in issues:
                            issue_type = issue['type']
                            if issue_type not in issues_by_type:
                                issues_by_type[issue_type] = 0
                            issues_by_type[issue_type] += 1
                    else:
                        valid_docs += 1
                        
                except Exception as e:
                    logger.error(f"Error analyzing document {doc_id}: {e}")
                    malformed_docs += 1
                    self.issues_found.append({
                        'doc_id': doc_id,
                        'type': 'analysis_error',
                        'severity': 'critical',
                        'message': f"Failed to analyze document: {e}",
                        'data': None
                    })
            
            analysis = {
                'total_documents': total_docs,
                'valid_documents': valid_docs,
                'malformed_documents': malformed_docs,
                'issues_by_type': issues_by_type,
                'issues_found': len(self.issues_found)
            }
            
            logger.info(f"Analysis complete: {total_docs} total, {valid_docs} valid, {malformed_docs} malformed")
            return analysis
    
    def _analyze_document(self, doc_id: str, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze a single DocumentReference for issues"""
        issues = []
        
        # Check required FHIR fields
        if not data.get('status'):
            issues.append({
                'doc_id': doc_id,
                'type': 'missing_status',
                'severity': 'critical',
                'message': 'Missing required field: status',
                'data': {'field': 'status'}
            })
        
        if not data.get('type'):
            issues.append({
                'doc_id': doc_id,
                'type': 'missing_type',
                'severity': 'critical',
                'message': 'Missing required field: type',
                'data': {'field': 'type'}
            })
        
        if not data.get('subject'):
            issues.append({
                'doc_id': doc_id,
                'type': 'missing_subject',
                'severity': 'critical',
                'message': 'Missing required field: subject',
                'data': {'field': 'subject'}
            })
        
        if not data.get('content'):
            issues.append({
                'doc_id': doc_id,
                'type': 'missing_content',
                'severity': 'critical',
                'message': 'Missing required field: content',
                'data': {'field': 'content'}
            })
        else:
            # Analyze content structure
            content_issues = self._analyze_content(doc_id, data.get('content', []))
            issues.extend(content_issues)
        
        # Check date format
        if data.get('date'):
            try:
                datetime.fromisoformat(data['date'].replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                issues.append({
                    'doc_id': doc_id,
                    'type': 'invalid_date_format',
                    'severity': 'warning',
                    'message': f"Invalid date format: {data.get('date')}",
                    'data': {'date': data.get('date')}
                })
        
        # Check for legacy field inconsistencies
        if data.get('docStatus') not in ['preliminary', 'final', 'amended', 'entered-in-error']:
            if data.get('docStatus'):
                issues.append({
                    'doc_id': doc_id,
                    'type': 'invalid_doc_status',
                    'severity': 'warning',
                    'message': f"Invalid docStatus: {data.get('docStatus')}",
                    'data': {'docStatus': data.get('docStatus')}
                })
        
        # Check context field structure (changed from single reference to array)
        if data.get('context') and not isinstance(data['context'], list):
            issues.append({
                'doc_id': doc_id,
                'type': 'legacy_context_format',
                'severity': 'warning',
                'message': 'Context field should be an array',
                'data': {'context': data.get('context')}
            })
        
        return issues
    
    def _analyze_content(self, doc_id: str, content: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Analyze content array for issues"""
        issues = []
        
        if not content or len(content) == 0:
            issues.append({
                'doc_id': doc_id,
                'type': 'empty_content_array',
                'severity': 'critical',
                'message': 'Content array is empty',
                'data': {'content': content}
            })
            return issues
        
        # Check first content item (standard for DocumentReference)
        content_item = content[0]
        
        if not content_item.get('attachment'):
            issues.append({
                'doc_id': doc_id,
                'type': 'missing_attachment',
                'severity': 'critical',
                'message': 'Content item missing attachment',
                'data': {'content_item': content_item}
            })
            return issues
        
        attachment = content_item['attachment']
        
        # Check for data field
        if not attachment.get('data'):
            issues.append({
                'doc_id': doc_id,
                'type': 'missing_attachment_data',
                'severity': 'critical',
                'message': 'Attachment missing data field',
                'data': {'attachment': attachment}
            })
            return issues
        
        # Validate base64 encoding
        try:
            decoded = base64.b64decode(attachment['data'])
            decoded_str = decoded.decode('utf-8')
            
            # Check if decoded content is reasonable
            if len(decoded_str.strip()) == 0:
                issues.append({
                    'doc_id': doc_id,
                    'type': 'empty_decoded_content',
                    'severity': 'warning',
                    'message': 'Decoded content is empty',
                    'data': {'attachment_data_length': len(attachment['data'])}
                })
            
            # Try to parse as JSON if contentType indicates JSON
            if attachment.get('contentType') == 'application/json':
                try:
                    json.loads(decoded_str)
                except json.JSONDecodeError:
                    issues.append({
                        'doc_id': doc_id,
                        'type': 'invalid_json_content',
                        'severity': 'warning',
                        'message': 'Content marked as JSON but is not valid JSON',
                        'data': {'content_preview': decoded_str[:100]}
                    })
                    
        except Exception as e:
            issues.append({
                'doc_id': doc_id,
                'type': 'invalid_base64_content',
                'severity': 'critical',
                'message': f"Failed to decode base64 content: {e}",
                'data': {'attachment_data_length': len(attachment.get('data', ''))}
            })
        
        # Check content type
        if not attachment.get('contentType'):
            issues.append({
                'doc_id': doc_id,
                'type': 'missing_content_type',
                'severity': 'warning',
                'message': 'Attachment missing contentType',
                'data': {'attachment': attachment}
            })
        
        return issues
    
    def fix_issues(self) -> Dict[str, Any]:
        """Fix identified issues in DocumentReference records"""
        logger.info("Starting issue fixes...")
        
        fixes_by_type = {}
        failed_fixes = []
        
        with self.Session() as session:
            for issue in self.issues_found:
                if issue['severity'] == 'critical':
                    try:
                        success = self._fix_issue(session, issue)
                        if success:
                            fix_type = issue['type']
                            if fix_type not in fixes_by_type:
                                fixes_by_type[fix_type] = 0
                            fixes_by_type[fix_type] += 1
                            self.fixes_applied.append(issue)
                        else:
                            failed_fixes.append(issue)
                    except Exception as e:
                        logger.error(f"Failed to fix issue {issue['type']} for doc {issue['doc_id']}: {e}")
                        failed_fixes.append(issue)
            
            session.commit()
        
        logger.info(f"Applied {len(self.fixes_applied)} fixes, {len(failed_fixes)} failed")
        
        return {
            'fixes_applied': len(self.fixes_applied),
            'fixes_by_type': fixes_by_type,
            'failed_fixes': len(failed_fixes),
            'failed_fix_details': failed_fixes
        }
    
    def _fix_issue(self, session, issue: Dict[str, Any]) -> bool:
        """Fix a specific issue"""
        doc_id = issue['doc_id']
        issue_type = issue['type']
        
        # Get current document data
        result = session.execute(text("""
            SELECT data FROM fhir_resources 
            WHERE id = :doc_id AND resource_type = 'DocumentReference'
        """), {'doc_id': doc_id})
        
        row = result.fetchone()
        if not row:
            logger.error(f"Document {doc_id} not found")
            return False
        
        data = row.data.copy()
        
        # Apply fixes based on issue type
        if issue_type == 'missing_status':
            data['status'] = 'current'
            logger.info(f"Fixed missing status for doc {doc_id}")
            
        elif issue_type == 'missing_type':
            data['type'] = {
                'coding': [{
                    'system': 'http://loinc.org',
                    'code': '11506-3',
                    'display': 'Progress note'
                }]
            }
            logger.info(f"Fixed missing type for doc {doc_id}")
            
        elif issue_type == 'missing_subject':
            # Try to find patient ID from other fields or use placeholder
            patient_id = self._extract_patient_id(data)
            data['subject'] = {'reference': f'Patient/{patient_id}'}
            logger.info(f"Fixed missing subject for doc {doc_id}")
            
        elif issue_type == 'missing_content':
            # Create minimal content structure
            data['content'] = [{
                'attachment': {
                    'contentType': 'text/plain',
                    'data': base64.b64encode('No content available'.encode('utf-8')).decode('utf-8'),
                    'title': 'Clinical Note',
                    'creation': datetime.now().isoformat()
                }
            }]
            logger.info(f"Fixed missing content for doc {doc_id}")
            
        elif issue_type == 'legacy_context_format':
            # Convert single context reference to array format
            if data.get('context') and not isinstance(data['context'], list):
                data['context'] = [data['context']]
            logger.info(f"Fixed legacy context format for doc {doc_id}")
            
        elif issue_type == 'invalid_doc_status':
            # Set to preliminary if invalid
            data['docStatus'] = 'preliminary'
            logger.info(f"Fixed invalid docStatus for doc {doc_id}")
            
        elif issue_type == 'empty_content_array':
            # Same as missing content
            data['content'] = [{
                'attachment': {
                    'contentType': 'text/plain',
                    'data': base64.b64encode('No content available'.encode('utf-8')).decode('utf-8'),
                    'title': 'Clinical Note',
                    'creation': datetime.now().isoformat()
                }
            }]
            logger.info(f"Fixed empty content array for doc {doc_id}")
            
        elif issue_type == 'missing_attachment':
            # Add attachment to first content item
            if data.get('content') and len(data['content']) > 0:
                data['content'][0]['attachment'] = {
                    'contentType': 'text/plain',
                    'data': base64.b64encode('No content available'.encode('utf-8')).decode('utf-8'),
                    'title': 'Clinical Note',
                    'creation': datetime.now().isoformat()
                }
            logger.info(f"Fixed missing attachment for doc {doc_id}")
            
        elif issue_type == 'missing_attachment_data':
            # Add data to attachment
            if (data.get('content') and len(data['content']) > 0 and 
                data['content'][0].get('attachment')):
                data['content'][0]['attachment']['data'] = base64.b64encode(
                    'No content available'.encode('utf-8')
                ).decode('utf-8')
            logger.info(f"Fixed missing attachment data for doc {doc_id}")
            
        else:
            # Issue type not fixable or not critical
            return False
        
        # Update the document in database
        session.execute(text("""
            UPDATE fhir_resources 
            SET data = :data, updated_at = :updated_at
            WHERE id = :doc_id AND resource_type = 'DocumentReference'
        """), {
            'doc_id': doc_id,
            'data': data,
            'updated_at': datetime.now()
        })
        
        return True
    
    def _extract_patient_id(self, data: Dict[str, Any]) -> str:
        """Try to extract patient ID from document data"""
        # Check various fields where patient ID might be stored
        if data.get('patientId'):
            return data['patientId']
        
        # Check identifier for patient reference
        if data.get('identifier'):
            for identifier in data['identifier']:
                if 'patient' in identifier.get('system', '').lower():
                    return identifier.get('value', 'unknown')
        
        # Default fallback
        return 'unknown'
    
    def validate_fixes(self) -> Dict[str, Any]:
        """Validate that fixes were applied correctly"""
        logger.info("Validating applied fixes...")
        
        with self.Session() as session:
            validation_results = {
                'total_validated': 0,
                'valid_after_fix': 0,
                'still_invalid': 0,
                'validation_errors': []
            }
            
            for fix in self.fixes_applied:
                doc_id = fix['doc_id']
                validation_results['total_validated'] += 1
                
                try:
                    # Get updated document
                    result = session.execute(text("""
                        SELECT data FROM fhir_resources 
                        WHERE id = :doc_id AND resource_type = 'DocumentReference'
                    """), {'doc_id': doc_id})
                    
                    row = result.fetchone()
                    if not row:
                        validation_results['validation_errors'].append({
                            'doc_id': doc_id,
                            'error': 'Document not found after fix'
                        })
                        continue
                    
                    # Validate the document structure
                    remaining_issues = self._analyze_document(doc_id, row.data)
                    critical_issues = [i for i in remaining_issues if i['severity'] == 'critical']
                    
                    if critical_issues:
                        validation_results['still_invalid'] += 1
                        validation_results['validation_errors'].append({
                            'doc_id': doc_id,
                            'remaining_issues': critical_issues
                        })
                    else:
                        validation_results['valid_after_fix'] += 1
                        
                except Exception as e:
                    validation_results['validation_errors'].append({
                        'doc_id': doc_id,
                        'error': f'Validation failed: {e}'
                    })
            
            logger.info(f"Validation complete: {validation_results['valid_after_fix']} valid, "
                       f"{validation_results['still_invalid']} still invalid")
            
            return validation_results
    
    def generate_report(self, analysis: Dict[str, Any], fixes: Dict[str, Any] = None, 
                       validation: Dict[str, Any] = None) -> str:
        """Generate a comprehensive report"""
        report = f"""
DocumentReference Migration Report
Generated: {datetime.now().isoformat()}

=== DATABASE ANALYSIS ===
Total Documents: {analysis['total_documents']}
Valid Documents: {analysis['valid_documents']}
Malformed Documents: {analysis['malformed_documents']}

Issues by Type:
"""
        
        for issue_type, count in analysis['issues_by_type'].items():
            report += f"  {issue_type}: {count}\n"
        
        if fixes:
            report += f"""
=== FIXES APPLIED ===
Total Fixes: {fixes['fixes_applied']}
Failed Fixes: {fixes['failed_fixes']}

Fixes by Type:
"""
            for fix_type, count in fixes['fixes_by_type'].items():
                report += f"  {fix_type}: {count}\n"
        
        if validation:
            report += f"""
=== VALIDATION RESULTS ===
Total Validated: {validation['total_validated']}
Valid After Fix: {validation['valid_after_fix']}
Still Invalid: {validation['still_invalid']}
Validation Errors: {len(validation['validation_errors'])}
"""
        
        return report


def main():
    parser = argparse.ArgumentParser(description='DocumentReference Migration Tool')
    parser.add_argument('--check', action='store_true', help='Check for issues only')
    parser.add_argument('--fix', action='store_true', help='Fix identified issues')
    parser.add_argument('--validate', action='store_true', help='Validate fixes')
    parser.add_argument('--report', type=str, help='Output report to file')
    
    args = parser.parse_args()
    
    if not any([args.check, args.fix, args.validate]):
        parser.print_help()
        return
    
    # Initialize migrator
    database_url = get_database_url()
    migrator = DocumentReferenceMigrator(database_url)
    
    try:
        # Always start with analysis
        analysis = migrator.analyze_database()
        fixes = None
        validation = None
        
        if args.fix and analysis['malformed_documents'] > 0:
            logger.info("Applying fixes...")
            fixes = migrator.fix_issues()
        
        if args.validate and fixes:
            logger.info("Validating fixes...")
            validation = migrator.validate_fixes()
        
        # Generate report
        report = migrator.generate_report(analysis, fixes, validation)
        
        if args.report:
            with open(args.report, 'w') as f:
                f.write(report)
            logger.info(f"Report saved to {args.report}")
        else:
            print(report)
        
        logger.info("Migration completed successfully")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()