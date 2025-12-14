"""
Async I/O Utilities for WintEHR

This module provides async-safe file operations to replace blocking I/O
in async contexts. Using synchronous file operations in async functions
blocks the event loop and degrades performance for all concurrent requests.

Usage:
    from shared.async_io import read_json_file, write_json_file

    # Instead of:
    # with open(path, 'r') as f:
    #     data = json.load(f)  # BLOCKING!

    # Use:
    data = await read_json_file(path)

Features:
- Async JSON file reading/writing
- Async text and binary file operations
- Built-in caching for static files (FHIR schemas, catalogs)
- Proper error handling with WintEHR exceptions
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional, Union
from datetime import datetime, timedelta
from functools import lru_cache

import aiofiles
import aiofiles.os

from shared.exceptions import ConfigurationError

logger = logging.getLogger(__name__)


# =============================================================================
# File Cache for Static Content
# =============================================================================

class FileCache:
    """
    Simple in-memory cache for static file contents.

    Useful for FHIR schemas, catalog data, and other files that don't change
    during runtime. Reduces disk I/O for frequently accessed files.
    """

    def __init__(self, default_ttl: timedelta = timedelta(hours=1)):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        """Get cached value if not expired."""
        if key not in self._cache:
            return None

        entry = self._cache[key]
        if datetime.now() > entry["expires"]:
            del self._cache[key]
            return None

        return entry["value"]

    def set(self, key: str, value: Any, ttl: Optional[timedelta] = None) -> None:
        """Cache a value with optional custom TTL."""
        expires = datetime.now() + (ttl or self._default_ttl)
        self._cache[key] = {
            "value": value,
            "expires": expires,
            "cached_at": datetime.now()
        }

    def invalidate(self, key: str) -> None:
        """Remove a specific key from cache."""
        self._cache.pop(key, None)

    def clear(self) -> None:
        """Clear all cached entries."""
        self._cache.clear()

    def stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        now = datetime.now()
        valid_entries = sum(1 for e in self._cache.values() if now < e["expires"])
        return {
            "total_entries": len(self._cache),
            "valid_entries": valid_entries,
            "expired_entries": len(self._cache) - valid_entries
        }


# Global cache instance for static files
_static_file_cache = FileCache(default_ttl=timedelta(hours=24))


# =============================================================================
# Async JSON Operations
# =============================================================================

async def read_json_file(
    file_path: Union[str, Path],
    use_cache: bool = False,
    cache_ttl: Optional[timedelta] = None
) -> Any:
    """
    Read and parse a JSON file asynchronously.

    Args:
        file_path: Path to the JSON file
        use_cache: Whether to cache the result (useful for static files)
        cache_ttl: Custom cache TTL (defaults to 24 hours if caching enabled)

    Returns:
        Parsed JSON content (dict, list, or primitive)

    Raises:
        ConfigurationError: If file not found or JSON parsing fails

    Example:
        # Read FHIR schema with caching
        schema = await read_json_file(
            "data/fhir_schemas/Patient.json",
            use_cache=True
        )
    """
    path = Path(file_path)
    cache_key = str(path.absolute())

    # Check cache first
    if use_cache:
        cached = _static_file_cache.get(cache_key)
        if cached is not None:
            logger.debug(f"Cache hit for {file_path}")
            return cached

    # Verify file exists
    if not await aiofiles.os.path.exists(path):
        raise ConfigurationError(
            message=f"JSON file not found: {file_path}",
            config_key=str(file_path)
        )

    try:
        async with aiofiles.open(path, mode='r', encoding='utf-8') as f:
            content = await f.read()
            data = json.loads(content)

        # Cache if requested
        if use_cache:
            _static_file_cache.set(cache_key, data, cache_ttl)
            logger.debug(f"Cached {file_path}")

        return data

    except json.JSONDecodeError as e:
        raise ConfigurationError(
            message=f"Invalid JSON in file: {file_path}",
            details={"parse_error": str(e), "line": e.lineno, "column": e.colno},
            cause=e
        )
    except PermissionError as e:
        raise ConfigurationError(
            message=f"Permission denied reading file: {file_path}",
            cause=e
        )
    except Exception as e:
        raise ConfigurationError(
            message=f"Error reading JSON file: {file_path}",
            details={"error_type": type(e).__name__},
            cause=e
        )


async def write_json_file(
    file_path: Union[str, Path],
    data: Any,
    indent: int = 2,
    ensure_ascii: bool = False
) -> None:
    """
    Write data to a JSON file asynchronously.

    Args:
        file_path: Path to write the JSON file
        data: Data to serialize (must be JSON-serializable)
        indent: JSON indentation (default 2 spaces)
        ensure_ascii: Whether to escape non-ASCII characters

    Raises:
        ConfigurationError: If writing fails

    Example:
        await write_json_file("output/results.json", {"status": "complete"})
    """
    path = Path(file_path)

    # Ensure parent directory exists
    parent = path.parent
    if not await aiofiles.os.path.exists(parent):
        await aiofiles.os.makedirs(parent)

    try:
        content = json.dumps(data, indent=indent, ensure_ascii=ensure_ascii)
        async with aiofiles.open(path, mode='w', encoding='utf-8') as f:
            await f.write(content)

        # Invalidate cache if this file was cached
        cache_key = str(path.absolute())
        _static_file_cache.invalidate(cache_key)

        logger.debug(f"Wrote JSON file: {file_path}")

    except TypeError as e:
        raise ConfigurationError(
            message=f"Data not JSON-serializable: {file_path}",
            details={"error": str(e)},
            cause=e
        )
    except PermissionError as e:
        raise ConfigurationError(
            message=f"Permission denied writing file: {file_path}",
            cause=e
        )
    except Exception as e:
        raise ConfigurationError(
            message=f"Error writing JSON file: {file_path}",
            details={"error_type": type(e).__name__},
            cause=e
        )


# =============================================================================
# Async Text File Operations
# =============================================================================

async def read_text_file(
    file_path: Union[str, Path],
    encoding: str = 'utf-8'
) -> str:
    """
    Read a text file asynchronously.

    Args:
        file_path: Path to the text file
        encoding: File encoding (default UTF-8)

    Returns:
        File contents as string

    Raises:
        ConfigurationError: If file not found or reading fails
    """
    path = Path(file_path)

    if not await aiofiles.os.path.exists(path):
        raise ConfigurationError(
            message=f"Text file not found: {file_path}",
            config_key=str(file_path)
        )

    try:
        async with aiofiles.open(path, mode='r', encoding=encoding) as f:
            return await f.read()
    except Exception as e:
        raise ConfigurationError(
            message=f"Error reading text file: {file_path}",
            details={"error_type": type(e).__name__},
            cause=e
        )


async def write_text_file(
    file_path: Union[str, Path],
    content: str,
    encoding: str = 'utf-8'
) -> None:
    """
    Write text to a file asynchronously.

    Args:
        file_path: Path to write the file
        content: Text content to write
        encoding: File encoding (default UTF-8)

    Raises:
        ConfigurationError: If writing fails
    """
    path = Path(file_path)

    # Ensure parent directory exists
    parent = path.parent
    if not await aiofiles.os.path.exists(parent):
        await aiofiles.os.makedirs(parent)

    try:
        async with aiofiles.open(path, mode='w', encoding=encoding) as f:
            await f.write(content)
        logger.debug(f"Wrote text file: {file_path}")
    except Exception as e:
        raise ConfigurationError(
            message=f"Error writing text file: {file_path}",
            details={"error_type": type(e).__name__},
            cause=e
        )


# =============================================================================
# Async Binary File Operations
# =============================================================================

async def read_binary_file(file_path: Union[str, Path]) -> bytes:
    """
    Read a binary file asynchronously.

    Args:
        file_path: Path to the binary file

    Returns:
        File contents as bytes

    Raises:
        ConfigurationError: If file not found or reading fails
    """
    path = Path(file_path)

    if not await aiofiles.os.path.exists(path):
        raise ConfigurationError(
            message=f"Binary file not found: {file_path}",
            config_key=str(file_path)
        )

    try:
        async with aiofiles.open(path, mode='rb') as f:
            return await f.read()
    except Exception as e:
        raise ConfigurationError(
            message=f"Error reading binary file: {file_path}",
            details={"error_type": type(e).__name__},
            cause=e
        )


async def write_binary_file(
    file_path: Union[str, Path],
    content: bytes
) -> None:
    """
    Write binary data to a file asynchronously.

    Args:
        file_path: Path to write the file
        content: Binary content to write

    Raises:
        ConfigurationError: If writing fails

    Example:
        # Write uploaded DICOM file
        await write_binary_file(
            f"uploads/{filename}",
            await file.read()
        )
    """
    path = Path(file_path)

    # Ensure parent directory exists
    parent = path.parent
    if not await aiofiles.os.path.exists(parent):
        await aiofiles.os.makedirs(parent)

    try:
        async with aiofiles.open(path, mode='wb') as f:
            await f.write(content)
        logger.debug(f"Wrote binary file: {file_path} ({len(content)} bytes)")
    except Exception as e:
        raise ConfigurationError(
            message=f"Error writing binary file: {file_path}",
            details={"error_type": type(e).__name__},
            cause=e
        )


# =============================================================================
# File System Utilities
# =============================================================================

async def file_exists(file_path: Union[str, Path]) -> bool:
    """Check if a file exists asynchronously."""
    return await aiofiles.os.path.exists(Path(file_path))


async def ensure_directory(dir_path: Union[str, Path]) -> None:
    """
    Ensure a directory exists, creating it if necessary.

    Args:
        dir_path: Path to the directory
    """
    path = Path(dir_path)
    if not await aiofiles.os.path.exists(path):
        await aiofiles.os.makedirs(path)
        logger.debug(f"Created directory: {dir_path}")


async def get_file_size(file_path: Union[str, Path]) -> int:
    """
    Get file size in bytes asynchronously.

    Args:
        file_path: Path to the file

    Returns:
        File size in bytes

    Raises:
        ConfigurationError: If file not found
    """
    path = Path(file_path)

    if not await aiofiles.os.path.exists(path):
        raise ConfigurationError(
            message=f"File not found: {file_path}",
            config_key=str(file_path)
        )

    stat = await aiofiles.os.stat(path)
    return stat.st_size


# =============================================================================
# Cache Management
# =============================================================================

def get_file_cache() -> FileCache:
    """Get the global file cache instance."""
    return _static_file_cache


def clear_file_cache() -> None:
    """Clear all cached file contents."""
    _static_file_cache.clear()
    logger.info("File cache cleared")


def get_cache_stats() -> Dict[str, Any]:
    """Get file cache statistics."""
    return _static_file_cache.stats()


# =============================================================================
# Synchronous Fallbacks (For Startup Only)
# =============================================================================

def read_json_file_sync(file_path: Union[str, Path]) -> Any:
    """
    Synchronous JSON file reading - USE ONLY AT STARTUP.

    This function is provided for loading configuration during application
    startup when the event loop may not be running yet. DO NOT use this
    in request handlers or async contexts.

    Args:
        file_path: Path to the JSON file

    Returns:
        Parsed JSON content
    """
    path = Path(file_path)

    if not path.exists():
        raise ConfigurationError(
            message=f"JSON file not found: {file_path}",
            config_key=str(file_path)
        )

    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise ConfigurationError(
            message=f"Invalid JSON in file: {file_path}",
            details={"parse_error": str(e)},
            cause=e
        )


# =============================================================================
# Exports
# =============================================================================

__all__ = [
    # JSON operations
    "read_json_file",
    "write_json_file",

    # Text operations
    "read_text_file",
    "write_text_file",

    # Binary operations
    "read_binary_file",
    "write_binary_file",

    # File system utilities
    "file_exists",
    "ensure_directory",
    "get_file_size",

    # Cache management
    "FileCache",
    "get_file_cache",
    "clear_file_cache",
    "get_cache_stats",

    # Sync fallback (startup only)
    "read_json_file_sync",
]
