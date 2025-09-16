export interface Student {
  id: string;
  name: string;
  email: string;
  grade?: string;
  class?: string;
}

export const students: Student[] = [];

export default students;