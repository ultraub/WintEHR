# Phase 4: Tasks Router Migration Plan

**Date**: 2025-10-12
**Status**: 📋 READY FOR IMPLEMENTATION
**Version**: WintEHR v4.2

---

## 🎯 Phase 4 Objective

Migrate tasks router from `fhir_client_config` wrapper to direct `HAPIFHIRClient` pattern, completing the pure FHIR architecture migration for all clinical workflows.

---

## 📋 Current State Analysis

### File to Migrate
**Target**: `backend/api/clinical/tasks/router.py`

**Current Pattern**: Uses `fhir_client_config` wrapper functions
```python
from services.fhir_client_config import (
    get_resource,
    search_resources,
    create_resource,
    update_resource,
    delete_resource
)
```

**Target Pattern**: Direct `HAPIFHIRClient` usage
```python
from services.hapi_fhir_client import HAPIFHIRClient
```

### Endpoints to Migrate

1. **POST** `/api/clinical/tasks/` - Create new clinical task
   - Uses: `create_resource('Task', fhir_task)`
   - Converts to: `await hapi_client.create("Task", fhir_task)`

2. **GET** `/api/clinical/tasks/` - List/search tasks with filters
   - Uses: `search_resources('Task', search_params)`
   - Converts to: `await hapi_client.search("Task", search_params)`

3. **GET** `/api/clinical/tasks/{task_id}` - Get specific task
   - Uses: `get_resource('Task', task_id)`
   - Converts to: `await hapi_client.read("Task", task_id)`

4. **PUT** `/api/clinical/tasks/{task_id}` - Update task
   - Uses: `update_resource('Task', task_id, fhir_task)`
   - Converts to: `await hapi_client.update("Task", task_id, fhir_task)`

5. **DELETE** `/api/clinical/tasks/{task_id}` - Delete task
   - Uses: `delete_resource('Task', task_id)`
   - Converts to: `await hapi_client.delete("Task", task_id)`

6. **PATCH** `/api/clinical/tasks/{task_id}/status` - Update task status
   - Uses: `update_resource('Task', task_id, updated_task)`
   - Converts to: `await hapi_client.update("Task", task_id, updated_task)`

### Task-Specific FHIR Resources

The router already uses proper FHIR Task resources:
```python
{
  "resourceType": "Task",
  "status": "pending" | "in-progress" | "completed" | "cancelled",
  "priority": "low" | "medium" | "high" | "urgent",
  "intent": "order",
  "description": "Task title/description",
  "for": {"reference": "Patient/{patient_id}"},
  "authoredOn": "2025-10-12T10:00:00Z",
  "requester": {"reference": "Practitioner/{user_id}"},
  "owner": {"reference": "Practitioner/{assignee_id}"},  # Optional
  "restriction": {"period": {"end": "due_date"}},        # Optional
  "code": {"coding": [{"code": "follow-up", ...}]},      # Optional
  "note": [{"text": "Additional details"}]               # Optional
}
```

---

## 🔄 Migration Steps

### Step 1: Update Imports

**Before**:
```python
from services.fhir_client_config import get_resource, search_resources, create_resource, update_resource, delete_resource
```

**After**:
```python
from services.hapi_fhir_client import HAPIFHIRClient
```

### Step 2: Convert Create Task Endpoint

**Before**:
```python
@router.post("/", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: dict = Depends(get_current_user)
):
    # Build fhir_task dict...

    try:
        created_task = create_resource('Task', fhir_task)  # Sync call
        task_id = created_task.id if hasattr(created_task, 'id') else str(uuid.uuid4())
        # ...
```

**After**:
```python
@router.post("/", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new clinical task as FHIR Task resource"""
    hapi_client = HAPIFHIRClient()

    # Build fhir_task dict... (same as before)
    fhir_task = {
        "resourceType": "Task",
        "status": task.status,
        # ... same FHIR structure
    }

    try:
        created_resource = await hapi_client.create("Task", fhir_task)  # Async
        task_id = created_resource["id"]  # Dict response, not object

        return TaskResponse(
            id=task_id,
            patient_id=task.patient_id,
            # ... same response mapping
        )
    except Exception as e:
        logger.error(f"Failed to create task: {e}")
        raise HTTPException(500, f"Failed to create task: {str(e)}")
```

### Step 3: Convert Search Tasks Endpoint

**Before**:
```python
@router.get("/", response_model=List[TaskResponse])
async def get_tasks(
    patient_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    # ...
    db: AsyncSession = Depends(get_db_session)
):
    search_params = {}
    # ... build params

    task_resources = search_resources('Task', search_params)  # Sync, returns fhirclient objects

    tasks = []
    if task_resources:
        for fhir_task in task_resources:
            # Extract with hasattr checks for fhirclient objects
            patient_ref = ""
            if hasattr(fhir_task, 'for_fhir') and fhir_task.for_fhir:
                patient_ref = fhir_task.for_fhir.reference if hasattr(fhir_task.for_fhir, 'reference') else ""
```

**After**:
```python
@router.get("/", response_model=List[TaskResponse])
async def get_tasks(
    patient_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assignee: Optional[str] = Query(None)
):
    """Get clinical tasks with optional filters using HAPI FHIR search"""
    hapi_client = HAPIFHIRClient()

    try:
        # Build search parameters
        search_params = {}
        if patient_id:
            search_params['patient'] = f'Patient/{patient_id}'
        if status:
            search_params['status'] = status
        if priority:
            search_params['priority'] = priority
        if assignee:
            search_params['owner'] = f'Practitioner/{assignee}'

        # Search HAPI FHIR - returns Bundle dict
        bundle = await hapi_client.search("Task", search_params)

        tasks = []
        for entry in bundle.get("entry", []):
            fhir_task = entry.get("resource", {})  # Dict, not object

            # Extract fields from dict
            patient_ref = fhir_task.get("for", {}).get("reference", "")
            patient_id_extracted = patient_ref.replace("Patient/", "") if patient_ref else ""

            # Extract description/note
            notes = fhir_task.get("note", [])
            description = notes[0].get("text") if notes else None

            # Extract due date
            restriction = fhir_task.get("restriction", {})
            period = restriction.get("period", {})
            due_date = period.get("end")

            # Extract assignee
            owner_ref = fhir_task.get("owner", {}).get("reference", "")
            assignee_id = owner_ref.replace("Practitioner/", "") if owner_ref else None

            # Extract task type
            code = fhir_task.get("code", {})
            codings = code.get("coding", [])
            task_type = codings[0].get("code", "general") if codings else "general"

            # Extract created by
            requester_ref = fhir_task.get("requester", {}).get("reference", "")
            created_by = requester_ref.replace("Practitioner/", "") if requester_ref else ""

            # Extract timestamps (HAPI meta data)
            meta = fhir_task.get("meta", {})
            created_at = meta.get("lastUpdated", datetime.now(timezone.utc).isoformat())

            # Build response
            task = TaskResponse(
                id=fhir_task.get("id", ""),
                patient_id=patient_id_extracted,
                title=fhir_task.get("description", ""),
                description=description,
                priority=fhir_task.get("priority", "medium"),
                status=fhir_task.get("status", "pending"),
                due_date=due_date,
                assignee=assignee_id,
                task_type=task_type,
                created_at=created_at,
                updated_at=created_at,
                created_by=created_by
            )
            tasks.append(task)

        return tasks

    except Exception as e:
        logger.error(f"Failed to search tasks: {e}")
        raise HTTPException(500, f"Failed to search tasks: {str(e)}")
```

### Step 4: Convert Read Task Endpoint

**Before**:
```python
@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    task_resource = get_resource('Task', task_id)  # Sync
    # ... extract from fhirclient object
```

**After**:
```python
@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """Get a specific clinical task by ID"""
    hapi_client = HAPIFHIRClient()

    try:
        fhir_task = await hapi_client.read("Task", task_id)  # Async, returns dict

        # Extract fields (same pattern as search)
        patient_ref = fhir_task.get("for", {}).get("reference", "")
        # ... etc (same extraction logic as search)

        return TaskResponse(
            id=fhir_task.get("id", ""),
            # ... same mapping
        )
    except Exception as e:
        logger.error(f"Failed to get task {task_id}: {e}")
        raise HTTPException(404, f"Task not found: {task_id}")
```

### Step 5: Convert Update Task Endpoint

**Before**:
```python
@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    db: AsyncSession = Depends(get_db_session)
):
    existing_task = get_resource('Task', task_id)  # Sync
    # ... update fields on fhirclient object
    updated_task = update_resource('Task', task_id, existing_task)  # Sync
```

**After**:
```python
@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_update: TaskUpdate
):
    """Update a clinical task"""
    hapi_client = HAPIFHIRClient()

    try:
        # Read existing task
        existing_task = await hapi_client.read("Task", task_id)

        # Update fields in dict
        if task_update.title is not None:
            existing_task["description"] = task_update.title
        if task_update.description is not None:
            existing_task["note"] = [{"text": task_update.description}]
        if task_update.priority is not None:
            existing_task["priority"] = task_update.priority
        if task_update.status is not None:
            existing_task["status"] = task_update.status
        if task_update.due_date is not None:
            existing_task["restriction"] = {
                "period": {"end": task_update.due_date.isoformat()}
            }
        if task_update.assignee is not None:
            existing_task["owner"] = {"reference": f"Practitioner/{task_update.assignee}"}

        # Update via HAPI FHIR
        updated_resource = await hapi_client.update("Task", task_id, existing_task)

        # Return updated task (same extraction as read)
        return await get_task(task_id)

    except Exception as e:
        logger.error(f"Failed to update task {task_id}: {e}")
        raise HTTPException(500, f"Failed to update task: {str(e)}")
```

### Step 6: Convert Delete Task Endpoint

**Before**:
```python
@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    delete_resource('Task', task_id)  # Sync
    return {"message": "Task deleted successfully"}
```

**After**:
```python
@router.delete("/{task_id}")
async def delete_task(task_id: str):
    """Delete a clinical task"""
    hapi_client = HAPIFHIRClient()

    try:
        await hapi_client.delete("Task", task_id)
        return {"message": "Task deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete task {task_id}: {e}")
        raise HTTPException(500, f"Failed to delete task: {str(e)}")
```

### Step 7: Convert Status Update Endpoint

**Before**:
```python
@router.patch("/{task_id}/status")
async def update_task_status(
    task_id: str,
    status_update: dict,
    db: AsyncSession = Depends(get_db_session)
):
    existing_task = get_resource('Task', task_id)  # Sync
    existing_task.status = status_update['status']
    updated_task = update_resource('Task', task_id, existing_task)  # Sync
```

**After**:
```python
@router.patch("/{task_id}/status")
async def update_task_status(
    task_id: str,
    status_update: dict
):
    """Update task status"""
    hapi_client = HAPIFHIRClient()

    try:
        # Read existing task
        existing_task = await hapi_client.read("Task", task_id)

        # Update status
        existing_task["status"] = status_update.get("status")

        # Update via HAPI FHIR
        updated_resource = await hapi_client.update("Task", task_id, existing_task)

        return {"message": "Task status updated successfully", "status": updated_resource["status"]}

    except Exception as e:
        logger.error(f"Failed to update task status {task_id}: {e}")
        raise HTTPException(500, f"Failed to update status: {str(e)}")
```

---

## 🧪 Testing Strategy

### Unit Tests
```python
# Test FHIR Task creation
async def test_create_task_via_hapi():
    hapi_client = HAPIFHIRClient()

    task_data = {
        "resourceType": "Task",
        "status": "pending",
        "intent": "order",
        "description": "Follow up with patient",
        "for": {"reference": "Patient/123"}
    }

    created_task = await hapi_client.create("Task", task_data)
    assert created_task["id"] is not None
    assert created_task["status"] == "pending"

# Test FHIR Task search
async def test_search_tasks_by_patient():
    hapi_client = HAPIFHIRClient()

    search_params = {"patient": "Patient/123", "status": "pending"}
    bundle = await hapi_client.search("Task", search_params)

    assert bundle["resourceType"] == "Bundle"
    assert "entry" in bundle
```

### Integration Tests
```bash
# Create task via API
curl -X POST http://localhost:8000/api/clinical/tasks/ \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "123",
    "title": "Follow up appointment",
    "priority": "high",
    "status": "pending",
    "task_type": "follow-up"
  }'

# Search tasks
curl "http://localhost:8000/api/clinical/tasks/?patient_id=123&status=pending"

# Update task status
curl -X PATCH http://localhost:8000/api/clinical/tasks/Task-123/status \
  -H "Content-Type: application/json" \
  -d '{"status": "in-progress"}'
```

---

## ✅ Success Criteria

1. ✅ All 6+ endpoints migrated to HAPIFHIRClient
2. ✅ All functions converted to async/await
3. ✅ FHIR Bundle handling for search results
4. ✅ Proper dict-based field extraction (no hasattr checks)
5. ✅ Comprehensive error handling
6. ✅ Unit and integration tests passing
7. ✅ No remaining `fhir_client_config` imports
8. ✅ Documentation updated

---

## 📊 Expected Impact

### Before Migration
- Uses `fhir_client_config` wrapper
- Sync operations with fhirclient objects
- Complex hasattr-based field extraction
- Inconsistent with other migrated routers

### After Migration
- Direct HAPI FHIR integration via HAPIFHIRClient
- Async operations with dict-based resources
- Clean dict-based field extraction
- Consistent with pharmacy and notes routers

### Performance
- **Similar to Phase 3.5/3.6 migrations**
- Async operations improve scalability
- Direct HAPI FHIR queries reduce overhead
- Consistent caching and connection pooling

---

## 🔗 Related Documentation

- [Phase 3 Migration Summary](./PHASE_3_MIGRATION_SUMMARY.md) - Context and patterns
- [Pharmacy Router Migration](./PHARMACY_ROUTER_MIGRATION_COMPLETE.md) - Similar migration (Phase 3.5)
- [Notes Router Migration](./NOTES_ROUTER_MIGRATION_COMPLETE.md) - Similar migration (Phase 3.6)
- [HAPIFHIRClient Documentation](../backend/services/hapi_fhir_client.py) - Client API reference

---

## 🚀 Implementation Timeline

**Estimated Effort**: 2-3 hours

1. **Hour 1**: Update imports and convert create/read endpoints
2. **Hour 2**: Convert search, update, delete endpoints
3. **Hour 3**: Testing, error handling, documentation

---

**Status**: 📋 READY FOR IMPLEMENTATION - Pattern established by Phases 3.5 and 3.6, clear migration path defined.
