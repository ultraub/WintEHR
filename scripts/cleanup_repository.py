#!/usr/bin/env python3
"""
Repository cleanup script to remove unnecessary files before deployment
"""

import os
import sys
import shutil
import argparse
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

class RepositoryCleaner:
    def __init__(self, dry_run=False, keep_logs=False, keep_db=True):
        self.dry_run = dry_run
        self.keep_logs = keep_logs
        self.keep_db = keep_db
        self.removed_count = 0
        self.removed_size = 0
        
    def get_size(self, path):
        """Get size of file or directory in bytes"""
        if os.path.isfile(path):
            return os.path.getsize(path)
        elif os.path.isdir(path):
            total = 0
            for dirpath, dirnames, filenames in os.walk(path):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    if os.path.exists(fp):
                        total += os.path.getsize(fp)
            return total
        return 0
    
    def format_size(self, size):
        """Format size in human readable format"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"
    
    def remove_item(self, path, description=""):
        """Remove file or directory"""
        if not os.path.exists(path):
            return
            
        size = self.get_size(path)
        
        if self.dry_run:
            logger.info(f"[DRY RUN] Would remove: {path} ({self.format_size(size)}) {description}")
        else:
            try:
                if os.path.isfile(path):
                    os.remove(path)
                elif os.path.isdir(path):
                    shutil.rmtree(path)
                logger.info(f"Removed: {path} ({self.format_size(size)}) {description}")
                self.removed_count += 1
                self.removed_size += size
            except Exception as e:
                logger.error(f"Failed to remove {path}: {e}")
    
    def clean_ds_store(self):
        """Remove all .DS_Store files"""
        logger.info("\n🧹 Cleaning .DS_Store files...")
        
        count = 0
        for root, dirs, files in os.walk('.'):
            for file in files:
                if file == '.DS_Store':
                    filepath = os.path.join(root, file)
                    self.remove_item(filepath, "- macOS metadata")
                    count += 1
        
        logger.info(f"   Found {count} .DS_Store files")
    
    def clean_pycache(self):
        """Remove all __pycache__ directories"""
        logger.info("\n🧹 Cleaning Python cache...")
        
        count = 0
        for root, dirs, files in os.walk('.'):
            if '__pycache__' in dirs:
                cache_dir = os.path.join(root, '__pycache__')
                self.remove_item(cache_dir, "- Python bytecode cache")
                dirs.remove('__pycache__')  # Don't descend into it
                count += 1
        
        logger.info(f"   Found {count} __pycache__ directories")
    
    def clean_logs(self):
        """Remove log files"""
        if self.keep_logs:
            logger.info("\n🧹 Skipping log files (--keep-logs specified)")
            return
            
        logger.info("\n🧹 Cleaning log files...")
        
        log_files = [
            'backend/backend.log',
            'backend/backend_clean.log',
            'backend/backend_new.log',
            'backend/backend_stable.log',
            'backend/frontend.log',
            'backend/server.log',
            'frontend/frontend-start.log',
            'frontend/frontend.log',
            'frontend/frontend_new.log',
            'frontend/frontend_stable.log',
            'ngrok_backend.log',
            'deployment_setup.log'
        ]
        
        for log_file in log_files:
            if os.path.exists(log_file):
                self.remove_item(log_file, "- log file")
    
    def clean_backups(self):
        """Remove backup archives"""
        logger.info("\n🧹 Cleaning backup archives...")
        
        # Look for backup files in parent directory
        parent_dir = Path('..').resolve()
        for file in parent_dir.glob('EMR-*-backup-*.tar.gz'):
            self.remove_item(str(file), "- backup archive")
    
    def clean_temp_docs(self):
        """Remove temporary documentation"""
        logger.info("\n🧹 Cleaning temporary documentation...")
        
        temp_docs = [
            'README 2.md',
            'imaging_workflow_test.md',
            'imaging_fixes_summary.md',
            'ssh-commands.md',
            'mouse_scroll_enhancement_summary.md',
            'test_wheel_navigation.md',
            'dicom_upload_test_guide.md',
            'FRONTEND_API_URL_FIX.md'
        ]
        
        for doc in temp_docs:
            if os.path.exists(doc):
                self.remove_item(doc, "- temporary documentation")
    
    def clean_dev_scripts(self):
        """Remove development-only scripts"""
        logger.info("\n🧹 Cleaning development scripts...")
        
        dev_scripts = [
            'setup_github.sh',
            'push_to_github.sh',
            'troubleshoot-providers.sh',
            'fix-frontend-api-url.sh',
            'fix-providers-ec2.sh',
            'test_local_deployment.sh',
            'test_emr_system.py',
            'backend/test_dicom_generation.py'
        ]
        
        for script in dev_scripts:
            if os.path.exists(script):
                self.remove_item(script, "- development script")
    
    def clean_node_cache(self):
        """Clean Node.js cache"""
        logger.info("\n🧹 Cleaning Node.js cache...")
        
        node_cache = 'frontend/node_modules/.cache'
        if os.path.exists(node_cache):
            self.remove_item(node_cache, "- Node.js build cache")
    
    def clean_databases(self):
        """Clean database files (optional)"""
        if self.keep_db:
            logger.info("\n🧹 Skipping database files (--keep-db specified)")
            return
            
        logger.info("\n🧹 Cleaning database files...")
        
        db_files = [
            'backend/data/emr.db',
            'backend/data/medflow.db'
        ]
        
        for db_file in db_files:
            if os.path.exists(db_file):
                self.remove_item(db_file, "- database file")
    
    def clean_outside_files(self):
        """Clean files outside main EMR directory"""
        logger.info("\n🧹 Cleaning files outside EMR directory...")
        
        outside_files = [
            '../CLAUDE.md',
            '../.DS_Store',
            '../test_backend.sh'
        ]
        
        for file in outside_files:
            if os.path.exists(file):
                self.remove_item(file, "- file outside EMR")
    
    def run(self):
        """Run all cleanup tasks"""
        logger.info("🚀 Starting repository cleanup...")
        if self.dry_run:
            logger.info("   (DRY RUN MODE - no files will be deleted)")
        
        # Run cleanup tasks
        self.clean_ds_store()
        self.clean_pycache()
        self.clean_logs()
        self.clean_backups()
        self.clean_temp_docs()
        self.clean_dev_scripts()
        self.clean_node_cache()
        self.clean_databases()
        self.clean_outside_files()
        
        # Summary
        logger.info("\n" + "="*50)
        logger.info("✅ Cleanup Summary:")
        logger.info(f"   Files/directories removed: {self.removed_count}")
        logger.info(f"   Total space freed: {self.format_size(self.removed_size)}")
        
        if self.dry_run:
            logger.info("\n   Run without --dry-run to actually remove files")

def main():
    parser = argparse.ArgumentParser(description='Clean repository for deployment')
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be removed without deleting'
    )
    parser.add_argument(
        '--keep-logs',
        action='store_true',
        help='Keep log files'
    )
    parser.add_argument(
        '--clean-db',
        action='store_true',
        help='Remove database files (default: keep)'
    )
    parser.add_argument(
        '--aggressive',
        action='store_true',
        help='Remove everything including logs and databases'
    )
    
    args = parser.parse_args()
    
    # Check if we're in the EMR directory
    if not os.path.exists('deployment.config.json'):
        logger.error("Error: Must run from the EMR directory")
        sys.exit(1)
    
    # Configure based on arguments
    keep_db = not args.clean_db and not args.aggressive
    keep_logs = args.keep_logs and not args.aggressive
    
    cleaner = RepositoryCleaner(
        dry_run=args.dry_run,
        keep_logs=keep_logs,
        keep_db=keep_db
    )
    
    cleaner.run()

if __name__ == '__main__':
    main()