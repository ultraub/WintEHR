# FHIR Resource Testing: Goal

**FHIR R4 Specification**: https://hl7.org/fhir/R4/goal.html  
**Test Status**: ❌ Not Started  
**Coverage**: 0% (0/18 test cases passing)

## Resource Overview

### Current Implementation Status
- ❌ **Storage**: No specific storage implementation found
- ❌ **Search Parameters**: Not implemented
- ❌ **Frontend Integration**: No care plan or goal management features
- ❌ **CRUD Operations**: Not implemented
- ❌ **Validation**: No FHIR R4 compliance

### Supported Search Parameters
| Parameter | Type | Status | R4 Required | Notes |
|-----------|------|--------|-------------|-------|
| _id | token | ❌ | Required | Basic resource ID search |
| _lastUpdated | date | ❌ | Optional | When resource was last updated |
| patient | reference | ❌ | Required | Patient for the goal |
| subject | reference | ❌ | Required | Subject of the goal |
| lifecycle-status | token | ❌ | Required | Goal status |
| achievement-status | token | ❌ | Optional | Achievement status |
| category | token | ❌ | Optional | Goal category |
| priority | token | ❌ | Optional | Goal priority |
| description | string | ❌ | Optional | Goal description |
| target-date | date | ❌ | Optional | Target achievement date |
| start-date | date | ❌ | Optional | Goal start date |
| identifier | token | ❌ | Optional | Goal identifier |

## Test Cases

### 1. CRUD Operations

#### 1.1 Create Goal
**Test ID**: `test_create_goal`
**Description**: Create valid Goal resource for patient care plan
**Expected Result**: 201 Created with valid FHIR goal

```python
def test_create_goal():
    goal_data = {
        "resourceType": "Goal",
        "identifier": [{
            "use": "official",
            "system": "http://www.acme.org/goals",
            "value": "GOAL-001"
        }],
        "lifecycleStatus": "active",
        "achievementStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/goal-achievement",
                "code": "in-progress",
                "display": "In Progress"
            }]
        },
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/goal-category",
                "code": "behavioral",
                "display": "Behavioral"
            }]
        }],
        "priority": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/goal-priority",
                "code": "medium-priority",
                "display": "Medium Priority"
            }]
        },
        "description": {
            "text": "Target weight is 160 to 180 lbs."
        },
        "subject": {
            "reference": "Patient/example",
            "display": "Peter James Chalmers"
        },
        "startDate": "2024-07-15",
        "target": [{
            "measure": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "3141-9",
                    "display": "Weight Measured"
                }]
            },
            "detailRange": {
                "low": {
                    "value": 160,
                    "unit": "lbs",
                    "system": "http://unitsofmeasure.org",
                    "code": "[lb_av]"
                },
                "high": {
                    "value": 180,
                    "unit": "lbs",
                    "system": "http://unitsofmeasure.org",
                    "code": "[lb_av]"
                }
            },
            "dueDate": "2024-12-31"
        }],
        "statusDate": "2024-07-15",
        "statusReason": "Patient wants to improve cardiovascular health.",
        "expressedBy": {
            "reference": "Patient/example",
            "display": "Peter James Chalmers"
        },
        "addresses": [{
            "reference": "Condition/12345",
            "display": "Obesity"
        }],
        "note": [{
            "text": "Patient is highly motivated to lose weight and has joined a gym."
        }],
        "outcomeCode": [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "161832001",
                "display": "Progressive weight loss"
            }]
        }],
        "outcomeReference": [{
            "reference": "Observation/example-weight",
            "display": "Weight measurement"
        }]
    }
    response = client.post("/fhir/Goal", json=goal_data)
    assert response.status_code == 201
    assert response.json()["resourceType"] == "Goal"
    assert response.json()["lifecycleStatus"] == "active"
```

**SQL Validation**:
```sql
SELECT COUNT(*) FROM fhir.resources 
WHERE resource_type = 'Goal' 
AND deleted = false;
```

**Status**: ❌ Not Implemented

#### 1.2 Read Goal
**Test ID**: `test_read_goal`
**Status**: ❌ Not Implemented

#### 1.3 Update Goal
**Test ID**: `test_update_goal`
**Status**: ❌ Not Implemented

#### 1.4 Delete Goal
**Test ID**: `test_delete_goal`
**Status**: ❌ Not Implemented

### 2. Search Parameter Tests

#### 2.1 Standard Parameters

##### 2.1.1 Search by _id
**Test ID**: `test_search_goal_by_id`
**Status**: ❌ Not Implemented

##### 2.1.2 Search by _lastUpdated
**Test ID**: `test_search_goal_by_lastUpdated`
**Status**: ❌ Not Implemented

#### 2.2 Resource-Specific Parameters

##### 2.2.1 Search by Patient
**Test ID**: `test_search_goal_by_patient`
**Parameter Type**: reference
**R4 Requirement**: Required
**Description**: Search goals by patient

```python
def test_search_goal_by_patient():
    response = client.get("/fhir/Goal?patient=Patient/123")
    assert response.status_code == 200
    
    # Verify all returned goals are for the correct patient
    bundle = response.json()
    for entry in bundle.get("entry", []):
        assert entry["resource"]["subject"]["reference"] == "Patient/123"
```

**Status**: ❌ Not Implemented

##### 2.2.2 Search by Lifecycle Status
**Test ID**: `test_search_goal_by_lifecycle_status`
**Parameter Type**: token
**R4 Requirement**: Required
**Description**: Search goals by lifecycle status

```python
def test_search_goal_by_lifecycle_status():
    response = client.get("/fhir/Goal?lifecycle-status=active")
    assert response.status_code == 200
    
    # Test multiple statuses
    response = client.get("/fhir/Goal?lifecycle-status=active,completed")
    assert response.status_code == 200
```

**Status**: ❌ Not Implemented

##### 2.2.3 Search by Category
**Test ID**: `test_search_goal_by_category`
**Parameter Type**: token
**R4 Requirement**: Optional
**Description**: Search goals by category (behavioral, dietary, etc.)

```python
def test_search_goal_by_category():
    # Search for behavioral goals
    response = client.get("/fhir/Goal?category=behavioral")
    assert response.status_code == 200
    
    # Search for dietary goals
    response = client.get("/fhir/Goal?category=dietary")
    assert response.status_code == 200
```

**Status**: ❌ Not Implemented

##### 2.2.4 Search by Target Date
**Test ID**: `test_search_goal_by_target_date`
**Parameter Type**: date
**R4 Requirement**: Optional
**Description**: Search goals by target achievement date

**Status**: ❌ Not Implemented

### 3. Care Planning Workflow Tests

#### 3.1 Goal Setting Workflow
**Test ID**: `test_goal_setting_workflow`
**Description**: Test complete goal setting process

```python
def test_goal_setting_workflow():
    # 1. Assess patient condition
    condition = get_patient_condition("Patient/123", "obesity")
    assert condition["clinicalStatus"]["coding"][0]["code"] == "active"
    
    # 2. Set weight loss goal
    goal = create_weight_loss_goal(
        patient_id="Patient/123",
        target_weight=170,
        timeframe_months=6
    )
    assert goal["lifecycleStatus"] == "active"
    assert goal["addresses"][0]["reference"].endswith(condition["id"])
    
    # 3. Create care plan with goal
    care_plan = create_care_plan_with_goal("Patient/123", goal["id"])
    assert goal["id"] in [g["reference"].split("/")[-1] for g in care_plan["goal"]]
    
    # 4. Track progress
    progress = track_goal_progress(goal["id"])
    assert progress["achievementStatus"]["coding"][0]["code"] in ["in-progress", "achieved"]
```

**Status**: ❌ Not Implemented

#### 3.2 Goal Achievement Tracking
**Test ID**: `test_goal_achievement_tracking`
**Description**: Test goal achievement and outcome tracking

```python
def test_goal_achievement_tracking():
    # 1. Start with active goal
    goal = get_active_goal("Patient/123", "weight-loss")
    assert goal["lifecycleStatus"] == "active"
    
    # 2. Record progress observations
    progress_obs = create_weight_observation(
        patient_id="Patient/123",
        weight_lbs=165,
        goal_id=goal["id"]
    )
    
    # 3. Update goal achievement status
    updated_goal = update_goal_achievement(goal["id"], "achieved")
    assert updated_goal["achievementStatus"]["coding"][0]["code"] == "achieved"
    
    # 4. Complete goal
    completed_goal = complete_goal(goal["id"])
    assert completed_goal["lifecycleStatus"] == "completed"
```

**Status**: ❌ Not Implemented

### 4. Integration Tests

#### 4.1 CarePlan Integration
**Test ID**: `test_goal_careplan_integration`
**Description**: Test integration with CarePlan resources

```python
def test_goal_careplan_integration():
    # Create goal and link to care plan
    goal = create_diabetes_management_goal("Patient/123")
    care_plan = create_care_plan_with_goals("Patient/123", [goal["id"]])
    
    # Verify linkage
    assert any(g["reference"].endswith(goal["id"]) for g in care_plan["goal"])
    
    # Test goal modification updates care plan
    updated_goal = update_goal_target_date(goal["id"], "2024-12-31")
    updated_care_plan = get_care_plan_by_id(care_plan["id"])
    # Care plan should reflect goal changes
```

**Status**: ❌ Not Implemented

#### 4.2 Condition Integration
**Test ID**: `test_goal_condition_integration`
**Description**: Test integration with Condition resources for goal addressing

```python
def test_goal_condition_integration():
    # Get patient condition
    condition = get_patient_condition("Patient/123", "diabetes")
    
    # Create goal addressing the condition
    goal = create_goal_for_condition(condition["id"], "HbA1c < 7%")
    
    # Verify goal addresses condition
    assert goal["addresses"][0]["reference"].endswith(condition["id"])
    
    # Test goal achievement affects condition management
    achieved_goal = achieve_goal(goal["id"])
    updated_condition = get_condition_by_id(condition["id"])
    # Condition management should reflect goal achievement
```

**Status**: ❌ Not Implemented

### 5. Error Handling Tests

#### 5.1 Invalid Goal Data
**Test ID**: `test_invalid_goal_validation`
**Description**: Test validation of malformed goal data

```python
def test_invalid_goal_validation():
    # Missing required lifecycle status
    invalid_data = {
        "resourceType": "Goal",
        "subject": {"reference": "Patient/123"}
    }
    response = client.post("/fhir/Goal", json=invalid_data)
    assert response.status_code == 400
    
    # Invalid lifecycle status value
    invalid_status = {
        "resourceType": "Goal",
        "lifecycleStatus": "invalid_status",
        "subject": {"reference": "Patient/123"}
    }
    response = client.post("/fhir/Goal", json=invalid_status)
    assert response.status_code == 400
```

**Status**: ❌ Not Implemented

#### 5.2 Conflicting Goal Targets
**Test ID**: `test_conflicting_goal_targets`
**Description**: Test handling of conflicting or unrealistic goal targets

**Status**: ❌ Not Implemented

## Issues Found

### Critical Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| CRIT-001 | No Goal resource implementation | Cannot manage patient goals | Implement Goal CRUD operations |
| CRIT-002 | No care planning system | Cannot track patient progress | Build care planning functionality |

### High Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| HIGH-001 | Missing integration with CarePlan | Fragmented care management | Integrate with care planning |
| HIGH-002 | No progress tracking system | Cannot monitor goal achievement | Build progress tracking |

### Medium Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| MED-001 | No goal analytics | Cannot analyze care effectiveness | Implement goal analytics |
| MED-002 | Limited condition integration | Goals not linked to diagnoses | Enhance condition linkage |

## Recommendations

### Immediate Actions Required
1. Implement Goal resource CRUD operations and storage
2. Add goal search parameters to storage engine
3. Create basic goal management interface
4. Build integration with patient conditions

### Future Enhancements
1. Implement comprehensive care planning system
2. Add automated goal progress tracking
3. Build goal analytics and outcome reporting
4. Integrate with patient portal for self-management

## Test Results Summary

**Total Test Cases**: 18  
**Passing**: 0 (0%)  
**Failing**: 0 (0%)  
**Not Implemented**: 18 (100%)

**Coverage by Category**:
- CRUD Operations: 0/4 (0%)
- Search Parameters: 0/8 (0%)
- Care Planning Workflows: 0/2 (0%)
- Integration Tests: 0/2 (0%)
- Error Handling: 0/2 (0%)

## Notes

- Goal resources are essential for patient-centered care and chronic disease management
- Integration with CarePlan, Condition, and Observation resources is critical
- Goal tracking supports quality measures and outcome-based care
- Patient engagement through goal setting improves care outcomes
- Should integrate with clinical decision support for goal recommendations

---

**Next Steps**:
1. Implement Goal resource in FHIR storage engine
2. Create goal management and care planning interfaces
3. Build goal tracking and progress monitoring systems
4. Develop integration with conditions and care plans