import { generateRoomsXML, generateStudentsXML, generateOfferingsXML, generateTravelTimesXML } from '../translators/xmlGenerator';

const dummyRooms = [
  { id: '101', building: 'Block 32', roomNumber: 'B32-101', capacity: 60, type: 'Theory', features: ['BYOD_READY'] },
  { id: '201', building: 'Block 33', roomNumber: 'B33-201', capacity: 40, type: 'Lab', features: [] }
];

const dummyStudents = [
  { externalId: 'STU001', name: 'John Doe', major: 'CSE', byod: true },
  { externalId: 'STU002', name: 'Jane Smith', major: 'ECE', minor: 'Embedded', byod: false }
];

const dummyCourses = [
  {
    id: 'CSE101',
    subject: 'CSE',
    courseNumber: '101',
    sections: [
      { id: 'S1', capacity: 60, type: 'Lecture' as const, minutesPerWeek: 180 },
      { id: 'S2', capacity: 30, type: 'Lab' as const, minutesPerWeek: 120 }
    ]
  }
];

const dummyTravels = [
  { block1: 'Block 32', block2: 'Block 33', isAdjacent: true },
  { block1: 'Block 32', block2: 'Block 10', isAdjacent: false }
];

console.log('--- ROOMS XML ---');
console.log(generateRoomsXML(dummyRooms));

console.log('\n--- STUDENTS XML ---');
console.log(generateStudentsXML(dummyStudents));

console.log('\n--- OFFERINGS XML ---');
console.log(generateOfferingsXML(dummyCourses));

console.log('\n--- TRAVEL TIMES XML ---');
console.log(generateTravelTimesXML(dummyTravels));
