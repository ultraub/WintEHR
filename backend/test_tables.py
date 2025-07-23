import asyncio
import sys
sys.path.append('/app')
from database import DATABASE_URL
from fhir.core.storage import FHIRStorageEngine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

async def test():
    engine = create_async_engine(DATABASE_URL)
    async with AsyncSession(engine) as session:
        storage = FHIRStorageEngine(session)
        await storage.ensure_tables()
        print('Tables created')

asyncio.run(test())
