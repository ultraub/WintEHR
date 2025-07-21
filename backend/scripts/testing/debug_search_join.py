#!/usr/bin/env python3
"""Debug the search join clauses."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fhir.core.search.basic import SearchParameterHandler
from fhir.core.storage import FHIRStorageEngine


async def debug_join():
    # Initialize search handler
    search_handler = SearchParameterHandler({})
    
    # Parse the search parameters
    raw_params = {'recorded-date': 'ge1988-08-08T09:41:49+00:00'}
    parsed_params, _ = search_handler.parse_search_params('Condition', raw_params)
    
    print(f"Parsed params: {parsed_params}")
    
    # Build search query
    join_clauses, where_clauses, sql_params = search_handler.build_search_query(
        'Condition', parsed_params
    )
    
    print(f"\nJoin clauses: {join_clauses}")
    print(f"Where clauses: {where_clauses}")
    print(f"SQL params: {sql_params}")
    
    # Build the full query
    base_query = """
        SELECT DISTINCT r.resource, r.fhir_id, r.version_id, r.last_updated
        FROM fhir.resources r
    """
    
    base_where = [
        "r.resource_type = :resource_type",
        "r.deleted = false"
    ]
    sql_params['resource_type'] = 'Condition'
    
    all_where_clauses = base_where + where_clauses
    
    query = base_query
    if join_clauses:
        query += " " + " ".join(join_clauses)
    query += " WHERE " + " AND ".join(all_where_clauses)
    
    print(f"\nFull query:\n{query}")
    print(f"\nWith params: {sql_params}")


if __name__ == "__main__":
    asyncio.run(debug_join())