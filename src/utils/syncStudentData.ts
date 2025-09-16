import { Student, StudentBasic } from '@/data/students';

export async function syncStudentData(): Promise<Student[]> {
  // Placeholder function for syncing student data
  // This should be implemented based on your data source
  return [];
}

export function validateStudentData(student: Partial<Student>): boolean {
  return !!(student.id && student.name && student.email);
}

// DB에서 모든 학생 데이터 가져오기
export async function fetchAllStudentsFromDB(): Promise<Student[]> {
  try {
    // 실제로는 Supabase에서 데이터를 가져와야 하지만,
    // prerender 단계에서는 API 호출이 불가능하므로 빈 배열 반환
    return [];
  } catch (error) {
    console.error('Error fetching students from DB:', error);
    return [];
  }
}

// 학생 데이터 비교
export function compareStudentData(dbStudents: Student[], hardcodedStudents: StudentBasic[]) {
  const comparison = {
    onlyInDB: dbStudents.filter(db => !hardcodedStudents.find(hc => hc.number === db.number)),
    onlyInHardcoded: hardcodedStudents.filter(hc => !dbStudents.find(db => db.number === hc.number)),
    matched: dbStudents.filter(db => hardcodedStudents.find(hc => hc.number === db.number)),
    matchedCount: 0,
    totalDB: dbStudents.length,
    totalHardcoded: hardcodedStudents.length
  };

  comparison.matchedCount = comparison.matched.length;
  return comparison;
}

// 비교 결과 로깅
export function logComparisonResults(comparison: ReturnType<typeof compareStudentData>) {
  console.log('=== 학생 데이터 비교 결과 ===');
  console.log('DB에만 있는 학생:', comparison.onlyInDB);
  console.log('하드코딩에만 있는 학생:', comparison.onlyInHardcoded);
  console.log('매칭된 학생:', comparison.matched);
  console.log(`매칭률: ${comparison.matchedCount}/${comparison.totalDB}`);
}

// 하드코딩 코드 생성
export function generateStudentDataCode(dbStudents: Student[]): string {
  const studentsCode = dbStudents.map(student =>
    `  { number: '${student.number}', name: '${student.name}' }`
  ).join(',\n');

  return `export const CURRENT_STUDENTS: StudentBasic[] = [\n${studentsCode}\n];`;
}

export default syncStudentData;