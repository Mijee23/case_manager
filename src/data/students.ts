export interface Student {
  id: string;
  name: string;
  email: string;
  grade?: string;
  class?: string;
}

export interface StudentBasic {
  number: string;
  name: string;
}

export const students: Student[] = [];

// 하드코딩된 현재 학생 목록 (임시 데이터)
export const CURRENT_STUDENTS: StudentBasic[] = [
  { number: '2024001', name: '김철수' },
  { number: '2024002', name: '이영희' },
  { number: '2024003', name: '박민수' }
];

// 모든 학생 옵션 가져오기 (호환성용)
export const getAllStudentOptions = () => {
  return CURRENT_STUDENTS.map(student => ({
    id: student.number,
    value: student.number,
    label: getStudentLabel(student.number, student.name),
    number: student.number,
    name: student.name,
    isRegistered: false
  }));
};

// 학생 라벨 생성 함수
export const getStudentLabel = (number: string, name: string) => {
  return `${number} - ${name}`;
};

export default students;