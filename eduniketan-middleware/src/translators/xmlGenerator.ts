import { create } from 'xmlbuilder2';

export interface RoomData {
  id: string;
  building: string;
  roomNumber: string;
  capacity: number;
  type: string;
  features: string[];
}

export function generateRoomsXML(rooms: RoomData[]): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('rooms', { 
      campus: 'LPU', 
      year: new Date().getFullYear().toString(), 
      term: 'Fall' 
    });

  rooms.forEach(room => {
    const r = root.ele('room', {
      id: room.id,
      building: room.building,
      roomNumber: room.roomNumber,
      capacity: room.capacity.toString(),
      type: room.type
    });

    if (room.features.length > 0) {
      const features = r.ele('features');
      room.features.forEach(f => {
        features.ele('feature', { name: f });
      });
    }
  });

  return root.end({ prettyPrint: true });
}

export interface StudentData {
  externalId: string;
  name: string;
  major: string;
  minor?: string;
  pathway?: string;
  byod: boolean;
}

export function generateStudentsXML(students: StudentData[]): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('students', { campus: 'LPU' });

  students.forEach(s => {
    const student = root.ele('student', { externalId: s.externalId });
    student.ele('name', { first: s.name.split(' ')[0], last: s.name.split(' ').slice(1).join(' ') });
    
    const academica = student.ele('academicAreaClassification');
    academica.ele('major', { code: s.major });
    if (s.minor) academica.ele('minor', { code: s.minor });
    
    if (s.byod) {
      student.ele('studentGroup', { code: 'BYOD' });
    }
  });

  return root.end({ prettyPrint: true });
}

export interface CourseData {
  id: string;
  subject: string;
  courseNumber: string;
  sections: {
    id: string;
    capacity: number;
    type: 'Lecture' | 'Lab';
    minutesPerWeek: number;
  }[];
}

export function generateOfferingsXML(courses: CourseData[]): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('offerings', { campus: 'LPU' });

  courses.forEach(course => {
    const offering = root.ele('offering', { 
      subject: course.subject, 
      courseNumber: course.courseNumber 
    });
    
    const config = offering.ele('config', { name: 'Default' });
    
    // Group by type (Subparts)
    const types = Array.from(new Set(course.sections.map(s => s.type)));
    
    types.forEach(type => {
      const typeSections = course.sections.filter(s => s.type === type);
      const subpart = config.ele('subpart', { 
        type: type, 
        minutesPerWeek: typeSections[0].minutesPerWeek.toString() 
      });
      
      typeSections.forEach(section => {
        subpart.ele('class', { 
          id: section.id, 
          capacity: section.capacity.toString() 
        });
      });
    });
  });

  return root.end({ prettyPrint: true });
}

export interface TravelTimeData {
  block1: string;
  block2: string;
  isAdjacent: boolean;
}

export function generateTravelTimesXML(travels: TravelTimeData[]): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('traveltimes');

  travels.forEach(t => {
    root.ele('traveltime', {
      id1: t.block1,
      id2: t.block2,
      minutes: t.isAdjacent ? '0' : '999' // Prohibit long transits
    });
  });

  return root.end({ prettyPrint: true });
}
