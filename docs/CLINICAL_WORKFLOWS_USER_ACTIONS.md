# Clinical Workflows - Detailed User Actions
**Generated**: 2025-01-27
**Purpose**: Specific user action workflows for each tab in WintEHR Clinical Workspace

---

## 1. SUMMARY TAB (`SummaryTab.js`)

### Workflow: "Reviewing Patient Status at Start of Visit"
**User Actions:**
1. **CLICK** on patient name in patient list
2. **WAIT** for Summary Tab to load (default tab)
3. **VIEW** patient demographics header
4. **SCAN** alert badges for critical items:
   - Red badge on Problems card = new/worsening condition
   - Yellow badge on Medications = refill needed
   - Red badge on Labs = critical value
5. **CLICK** "Refresh" button if data seems stale
6. **HOVER** over metric cards to see tooltips with details

### Workflow: "Navigating to Problem Details"
**User Actions:**
1. **VIEW** Problems summary card showing "5 Active Problems"
2. **CLICK** on the Problems card
3. **TRIGGERED**: Navigation to Chart Review tab with problems section expanded
4. **RESULT**: Chart Review tab opens with problems list visible

### Workflow: "Checking Recent Lab Results"
**User Actions:**
1. **SCROLL** to Recent Labs section
2. **VIEW** list of lab results from last 7 days
3. **IDENTIFY** abnormal results (marked with red/yellow icons)
4. **CLICK** on specific lab result item
5. **TRIGGERED**: Navigation to Results tab with that result selected
6. **RESULT**: Results tab opens with detailed lab view

### Workflow: "Printing Patient Summary"
**User Actions:**
1. **CLICK** Print button in top toolbar
2. **WAIT** for print preview to generate
3. **VIEW** formatted summary including:
   - Patient demographics
   - Active problems list
   - Current medications
   - Recent labs
   - Upcoming appointments
4. **CLICK** Print in browser dialog
5. **RESULT**: Physical printout or PDF saved

---

## 2. CHART REVIEW TAB (`ChartReviewTabOptimized.js`)

### Workflow: "Adding a New Problem/Diagnosis"
**User Actions:**
1. **NAVIGATE** to Chart Review tab
2. **LOCATE** Problems/Conditions section
3. **CLICK** "+" button next to Problems header
4. **TRIGGERED**: `ConditionDialogEnhanced` opens
5. **SEARCH** for diagnosis in search field (e.g., type "diabetes")
6. **SELECT** from dropdown results (e.g., "Type 2 Diabetes Mellitus")
7. **CHOOSE** clinical status: "Active"
8. **SELECT** severity: "Moderate"
9. **ENTER** onset date using date picker
10. **TYPE** clinical notes in notes field
11. **CLICK** "Save" button
12. **RESULT**: New condition appears in problems list with "Active" status

### Workflow: "Prescribing a New Medication"
**User Actions:**
1. **LOCATE** Medications section in Chart Review
2. **CLICK** "+" button next to Medications header
3. **TRIGGERED**: `MedicationDialogEnhanced` opens
4. **TYPE** medication name in search (e.g., "metformin")
5. **WAIT** for search results to load
6. **SELECT** "Metformin 500mg tablets" from results
7. **SYSTEM CHECK**: Allergy checking runs automatically
8. **ENTER** dosage: "500"
9. **SELECT** unit: "mg"
10. **SELECT** frequency: "Twice daily (BID)"
11. **SELECT** route: "Oral (PO)"
12. **ENTER** duration: "90" days
13. **TYPE** sig: "Take 1 tablet by mouth twice daily with meals"
14. **SELECT** pharmacy from dropdown
15. **REVIEW** drug interaction warnings (if any appear)
16. **CLICK** "Prescribe" button
17. **CONFIRM** if allergy warning appears
18. **RESULT**: Prescription created and sent to pharmacy

### Workflow: "Documenting a New Allergy"
**User Actions:**
1. **LOCATE** Allergies section
2. **CLICK** "+" button next to Allergies header
3. **TRIGGERED**: `AllergyDialogEnhanced` opens
4. **SELECT** allergen type: "Medication"
5. **SEARCH** for allergen (e.g., "penicillin")
6. **SELECT** from results
7. **SELECT** reaction: "Hives"
8. **CHOOSE** severity: "Moderate"
9. **CHOOSE** criticality: "High"
10. **ENTER** onset date
11. **TYPE** additional notes
12. **CLICK** "Save"
13. **RESULT**: Allergy added with red warning icon

### Workflow: "Updating Medication Status"
**User Actions:**
1. **LOCATE** specific medication in list
2. **CLICK** on medication card to expand
3. **CLICK** "Edit" button
4. **TRIGGERED**: `MedicationDialogEnhanced` opens in edit mode
5. **CHANGE** status from "Active" to "Stopped"
6. **ENTER** reason for stopping
7. **ENTER** stop date
8. **CLICK** "Save"
9. **RESULT**: Medication shows as discontinued with strikethrough

### Workflow: "Reviewing and Dismissing CDS Alerts"
**User Actions:**
1. **VIEW** CDS alert banner at top of Chart Review
2. **READ** alert message (e.g., "Patient due for A1C test")
3. **CLICK** "X" to dismiss temporarily
4. **OR CLICK** "Dismiss Permanently" 
5. **RESULT**: Alert removed from view, stored in dismissed alerts

---

## 3. ENCOUNTERS TAB (`EncountersTab.js`)

### Workflow: "Creating a New Encounter"
**User Actions:**
1. **NAVIGATE** to Encounters tab
2. **CLICK** "New Encounter" button (+ icon)
3. **TRIGGERED**: `EncounterCreationDialog` opens
4. **SELECT** encounter type: "Ambulatory"
5. **TYPE** reason for visit: "Follow-up for diabetes"
6. **SELECT** provider from dropdown
7. **ENTER** date (defaults to today)
8. **ENTER** time (defaults to now)
9. **SELECT** department: "Internal Medicine"
10. **CLICK** "Create Encounter"
11. **RESULT**: New encounter created with "in-progress" status

### Workflow: "Writing a Clinical Note"
**User Actions:**
1. **LOCATE** encounter in list (usually today's)
2. **CLICK** "Add Note" button on encounter card
3. **TRIGGERED**: `EnhancedNoteEditor` opens
4. **SELECT** note template: "SOAP Note"
5. **TYPE** in Subjective section: "Patient reports blood sugar well controlled"
6. **TYPE** in Objective section: "BP 120/80, Weight 180 lbs"
7. **TYPE** in Assessment section: "Type 2 DM, controlled"
8. **TYPE** in Plan section: "Continue metformin, recheck A1C in 3 months"
9. **CLICK** "Save Note"
10. **RESULT**: Note attached to encounter

### Workflow: "Signing an Encounter"
**User Actions:**
1. **LOCATE** encounter with "Ready to Sign" status
2. **CLICK** "Sign" button
3. **TRIGGERED**: `EncounterSigningDialog` opens
4. **REVIEW** encounter summary:
   - Clinical notes
   - Orders placed
   - Diagnoses
5. **ENTER** provider PIN/password
6. **CLICK** "Sign Encounter"
7. **RESULT**: Encounter status changes to "finished", locked from editing

---

## 4. RESULTS TAB (`ResultsTabOptimized.js`)

### Workflow: "Reviewing New Lab Results"
**User Actions:**
1. **NAVIGATE** to Results tab
2. **VIEW** default "Lab Results" tab selected
3. **IDENTIFY** new results (marked with "NEW" badge)
4. **CLICK** on result row (e.g., "Hemoglobin A1C")
5. **VIEW** result value: "7.2%" with yellow warning (slightly high)
6. **VIEW** reference range: "4.0-6.0%"
7. **VIEW** trend icon showing increase
8. **CLICK** "Acknowledge" button
9. **RESULT**: Result marked as reviewed

### Workflow: "Viewing Result Trends"
**User Actions:**
1. **LOCATE** specific lab test (e.g., Glucose)
2. **CLICK** "Trends" view toggle button
3. **TRIGGERED**: `LabTrendsChart` component loads
4. **VIEW** line graph showing values over time
5. **HOVER** over data points to see exact values and dates
6. **ADJUST** date range selector to "Last 6 months"
7. **VIEW** updated graph
8. **CLICK** "Export" to save trend data

### Workflow: "Responding to Critical Value"
**User Actions:**
1. **RECEIVE** alert notification (red banner)
2. **VIEW** "CRITICAL VALUE: Potassium 6.5 (High)"
3. **CLICK** on alert to open result details
4. **CLICK** "Contact Patient" button
5. **TRIGGERED**: Opens communication options
6. **SELECT** "Phone" 
7. **DOCUMENT** action taken in notes field
8. **CLICK** "Mark as Addressed"
9. **RESULT**: Critical value acknowledged and documented

### Workflow: "Filtering Results by Date"
**User Actions:**
1. **CLICK** date filter dropdown
2. **SELECT** "Last 30 days"
3. **VIEW** filtered results list updates
4. **TYPE** in search box: "cholesterol"
5. **VIEW** results filtered to cholesterol tests in last 30 days
6. **CLICK** "Clear Filters" to reset

---

## 5. ORDERS TAB (`EnhancedOrdersTab.js`)

### Workflow: "Placing a Lab Order"
**User Actions:**
1. **NAVIGATE** to Orders tab
2. **CLICK** "New Order" button
3. **TRIGGERED**: `CPOEDialog` opens
4. **SELECT** category: "Laboratory"
5. **SEARCH** for test: "Complete Blood Count"
6. **SELECT** "CBC with Differential" from results
7. **SELECT** priority: "Routine"
8. **ENTER** clinical indication: "Annual physical"
9. **SELECT** collection date: Tomorrow
10. **REVIEW** order summary
11. **CLICK** "Place Order"
12. **ENTER** provider PIN
13. **RESULT**: Order sent to lab with "active" status

### Workflow: "Using Order Sets"
**User Actions:**
1. **CLICK** "Order Sets" button
2. **SELECT** "Diabetes Follow-up Panel"
3. **VIEW** pre-selected orders:
   - Hemoglobin A1C
   - Lipid Panel
   - Comprehensive Metabolic Panel
   - Urine Microalbumin
4. **UNCHECK** any unwanted tests
5. **MODIFY** priority for specific tests if needed
6. **CLICK** "Place All Orders"
7. **RESULT**: Multiple orders placed simultaneously

### Workflow: "Modifying an Existing Order"
**User Actions:**
1. **LOCATE** pending order in list
2. **CLICK** "Edit" button on order row
3. **CHANGE** priority from "Routine" to "STAT"
4. **UPDATE** clinical indication
5. **CLICK** "Save Changes"
6. **RESULT**: Order updated, notification sent to lab

### Workflow: "Cancelling an Order"
**User Actions:**
1. **LOCATE** order to cancel
2. **VERIFY** status is "pending" or "active"
3. **CLICK** "Cancel" button
4. **ENTER** reason for cancellation
5. **CONFIRM** cancellation
6. **RESULT**: Order status changes to "cancelled"

---

## 6. PHARMACY TAB (`PharmacyTab.js`)

### Workflow: "Processing a Prescription (Pharmacist)"
**User Actions:**
1. **NAVIGATE** to Pharmacy tab
2. **VIEW** prescription queue
3. **CLICK** on prescription to review
4. **VERIFY** medication details:
   - Drug name and strength
   - Dosage and frequency
   - Quantity
5. **CHECK** for drug interactions (automatic)
6. **CHECK** insurance coverage
7. **CLICK** "Verify" button
8. **RESULT**: Prescription marked as verified

### Workflow: "Dispensing Medication (Pharmacist)"
**User Actions:**
1. **LOCATE** verified prescription
2. **CLICK** "Dispense" button
3. **TRIGGERED**: Dispensing dialog opens
4. **SCAN** medication barcode
5. **VERIFY** medication matches prescription
6. **ENTER** lot number
7. **ENTER** expiration date
8. **COUNT** and enter quantity dispensed
9. **PRINT** medication label
10. **CLICK** "Complete Dispensing"
11. **RESULT**: Medication marked as dispensed

### Workflow: "Processing Refill Request"
**User Actions:**
1. **VIEW** refill requests queue
2. **CLICK** on refill request
3. **CHECK** remaining refills authorized
4. **VERIFY** no medication changes
5. **CLICK** "Approve Refill"
6. **OR** "Request Provider Authorization" if no refills left
7. **RESULT**: Refill approved or sent to provider

---

## 7. IMAGING TAB (`ImagingTab.js`)

### Workflow: "Viewing DICOM Images"
**User Actions:**
1. **NAVIGATE** to Imaging tab
2. **VIEW** list of imaging studies
3. **CLICK** on study (e.g., "Chest X-Ray")
4. **WAIT** for DICOM viewer to load
5. **USE** mouse wheel to scroll through image slices
6. **CLICK** and drag to adjust window/level
7. **CLICK** measurement tool
8. **CLICK** and drag on image to measure
9. **CLICK** "Compare" button
10. **SELECT** prior study for comparison
11. **VIEW** side-by-side comparison

### Workflow: "Ordering Imaging Study"
**User Actions:**
1. **CLICK** "Order Imaging" button
2. **SELECT** modality: "X-Ray"
3. **SELECT** body part: "Chest"
4. **SELECT** views: "PA and Lateral"
5. **ENTER** clinical indication: "Cough x 2 weeks"
6. **SELECT** priority: "Routine"
7. **ADD** special instructions if needed
8. **CLICK** "Place Order"
9. **RESULT**: Order sent to radiology

---

## 8. DOCUMENTATION TAB (`DocumentationTabEnhanced.js`)

### Workflow: "Creating a Progress Note"
**User Actions:**
1. **NAVIGATE** to Documentation tab
2. **CLICK** "New Document" button
3. **SELECT** document type: "Progress Note"
4. **SELECT** template: "General Progress Note"
5. **TYPE** in Chief Complaint field
6. **TYPE** in HPI section
7. **FILL** Review of Systems checkboxes
8. **TYPE** Physical Exam findings
9. **TYPE** Assessment and Plan
10. **CLICK** "Save Draft"
11. **CLICK** "Sign Note"
12. **ENTER** provider credentials
13. **RESULT**: Note signed and locked

### Workflow: "Uploading External Document"
**User Actions:**
1. **CLICK** "Upload Document" button
2. **CLICK** "Choose File"
3. **SELECT** PDF from file system
4. **SELECT** document type: "Consultation Report"
5. **ENTER** document date
6. **ENTER** source: "External Cardiology"
7. **ADD** notes/summary
8. **CLICK** "Upload"
9. **RESULT**: Document added to patient record

---

## 9. CARE PLAN TAB (`CarePlanTabEnhanced.js`)

### Workflow: "Creating a Care Plan"
**User Actions:**
1. **NAVIGATE** to Care Plan tab
2. **CLICK** "New Care Plan" button
3. **ENTER** care plan title: "Diabetes Management"
4. **SELECT** conditions addressed: "Type 2 Diabetes"
5. **ADD** goal: "Maintain A1C < 7.0"
6. **SET** target date: 3 months
7. **ADD** intervention: "Medication adherence counseling"
8. **ASSIGN** to care team member
9. **SET** review date
10. **CLICK** "Create Care Plan"
11. **RESULT**: Active care plan created

### Workflow: "Updating Care Plan Progress"
**User Actions:**
1. **LOCATE** active care plan
2. **CLICK** "Update Progress" button
3. **SELECT** goal to update
4. **CHANGE** status: "In Progress" to "Achieved"
5. **ENTER** outcome notes: "A1C decreased to 6.8"
6. **UPLOAD** supporting documentation
7. **CLICK** "Save Progress"
8. **RESULT**: Care plan updated with progress

---

## 10. TIMELINE TAB (`TimelineTabModern.js`)

### Workflow: "Reviewing Patient History"
**User Actions:**
1. **NAVIGATE** to Timeline tab
2. **VIEW** chronological event list
3. **USE** filter buttons to show/hide event types
4. **CLICK** "Medications" filter to show only medication events
5. **SCROLL** to find specific date
6. **CLICK** on event to expand details
7. **VIEW** related resources and notes
8. **CLICK** "Jump to Record" to navigate to full resource

### Workflow: "Identifying Patterns"
**User Actions:**
1. **SELECT** date range: "Last 6 months"
2. **ENABLE** filters for "Lab Results" and "Medications"
3. **VIEW** timeline showing correlation between medication changes and lab values
4. **CLICK** on medication change event
5. **NOTE** subsequent lab result changes
6. **DOCUMENT** observation in patient notes