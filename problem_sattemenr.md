System Requirements Specification (SRS): Eduniketan Allocation Engine
1. System Overview & Final Deliverables
The Eduniketan Allocation Engine is a high-capacity constraint satisfaction system designed to process 40,000+ student records.
Final System Outputs:
Upon successful execution, the system will generate and export the following master deliverables:
Fully Mapped Section-Wise Distribution: A definitive list assigning every valid Student UID to a specific Section ID, clustered optimally by Minors and Pathways.
Teacher-Wise Distribution: A comprehensive load-sheet for all faculty, detailing their assigned sections, rooms, and total weekly hours.
Course-Mapped Master Timetable: A 3D allocation matrix (Time $\times$ Room $\times$ Section) guaranteeing zero double-bookings and respecting all movement physics across the LPU campus.

2. Data Ingestion Blueprint (System Inputs)
The system requires rigid data structures to calculate penalties and routes. To address the physical layout of the campus, the Infrastructure entity includes spatial mapping fields.
A. Entity Data Dictionary
Entity
Required Fields
Students
UID, Name, Program, Batch_Year, Specialization_ID, Minor_ID (Highest Priority), Pathway_ID, BYOD_Flag (Boolean), Residence_Type (Hostel/Day Scholar), Backlog_Courses[].
Infrastructure
Room_ID, Block_ID, Latitude, Longitude, Connected_Blocks[] (Array of adjacent blocks accessible in < 4 mins), Capacity_Lecture, Room_Type (Lab/Theory), BYOD_Ready.
Faculty
Teacher_ID, Department_ID, Expertise_Tags[], Max_Teaching_Hours_Day (Max 6), Forbidden_Slots[], Travel_Tolerance.
Courses
Course_ID, Credit_Hours, Type (Theory/Lab), Required_Equipment, Session_Duration (60m, 90m, 120m).

Architectural Note on Latitude/Longitude: While Lat/Long coordinates can be stored, routing engines prefer a Graph Matrix. By utilizing the Connected_Blocks[] array, the system immediately knows if Block 32 and Block 33 are physically bridged. If a block is not in the connected array, the solver flags it as a "distant transit."

3. The Constraint Logic Matrix
Constraints are graded by severity. The solver will abort if a Category 1 constraint is violated, and will continuously optimize to minimize penalties from Categories 2 and 3.
Pre-Processing (Clustering Priority)
Specialization Integrity: Before the timetable solver runs, the system MUST group students sharing a "Fullstack Minor" (or other specific minors) into the same atomic sections. This guarantees peer learning and prevents curriculum fragmentation.
Category 1: Hard Constraints (Critical - Must be 0 violations)
These are logical impossibilities. Any violation renders the schedule illegal.
Student Conflict: A student cannot be scheduled in two sections/classes at the same time.
Room Over-Capacity: The total number of students in an assigned section must be less than or equal to the Room Capacity.
Room Conflict: A single physical room cannot host two different classes in the same timeslot.
Teacher Conflict: An instructor cannot teach two classes simultaneously.
Infrastructure Fit: A "Lab" course must be assigned to a "Lab" room; a "BYOD" group must be assigned to a "BYOD-Ready" room.
Curriculum Lock: Students in the exact same "Pathway" or "Specialization" must have their core classes scheduled without overlap.
Category 2: High-Soft Constraints (Operational - High Penalty)
Violating these causes severe logistical breakdowns for the university.
7. The Zero-Buffer Transit Rule (LPU Specific): Because there is no 10-minute movement buffer, back-to-back classes for a student or teacher MUST be scheduled either in the same Block or within the Connected_Blocks[] array. Distant block movements are strictly penalized unless separated by a free time slot.
8. Teacher Availability: Strict adherence to a teacher's "Forbidden Slots."
9. BYOD Isolation: Group 1 (BYOD) and Group 2 (Non-BYOD) students must never be mixed in a non-BYOD lab environment.
10. Daily Limit (LPU Specific): No student or teacher shall exceed 6 hours of scheduled classes in a single day.
Category 3: Low-Soft Constraints (Experience - Low Penalty)
Optimizations for human comfort and Eduniketan's LMS UX.
11. Day Scholar Gaps: Minimize isolated "Holes" in the schedule. Day scholars should not suffer a 4-hour gap between two 1-hour classes.
12. Mandatory Lunch Break: Ensure every student and teacher is allocated at least 1 contiguous hour of free time strictly between 12:00 PM and 3:00 PM.
13. Schedule Compactness: Maximize back-to-back scheduling for teachers (within connected blocks) to prevent their 6 teaching hours from spanning a 10-hour campus presence.

4. Interface & User Experience (UX) Architecture
The system requires specialized UI views to manage the ingestion of 40,000 records and visualize the massive output.
A. The "Data Health" Ingestor (Input)
Validation Dashboard: A pre-flight screen that scans uploaded CSVs/databases and highlights anomalies in Red (e.g., "Orphaned Students" with missing Minor IDs, or Rooms missing Capacity limits).
The "Weight" Tuner: Administrative sliders to adjust algorithmic penalties dynamically. Example: Increasing the penalty weight of "Day Scholar Gaps" forces the solver to prioritize compact schedules over teacher compactness.
B. The "Optimizer" Output (Verification)
Global Gantt View: A master interactive chart filtering the timetable by Rooms and Teachers to visually verify capacity and zero-conflicts.
The "Student Persona" Audit: An automated QA view that randomly samples 10 "Day Scholar" profiles and 10 "Hosteller" profiles. It generates their individual weekly timetables so administrators can perform a human sanity check on the AI's logic before publishing to the LMS.