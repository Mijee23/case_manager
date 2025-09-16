# 학생 마스터 시스템 전환 가이드

## 📋 개요

기존의 복잡한 캐싱 시스템을 대신하여 **엑셀 기반 학생 명단 관리 시스템**으로 전환되었습니다.

### 🎯 핵심 개선사항
- **관리자가 엑셀로 학생 명단 업로드** → 모든 드롭다운에서 사용
- **회원가입되지 않은 학생 선택 시** → 친화적인 팝업 안내
- **복잡한 캐싱 로직 제거** → 단순하고 빠른 시스템
- **실시간 회원가입 상태 반영** → 자동 동기화

---

## 🛠️ 설정 방법

### 1. 데이터베이스 마이그레이션

**`supabase-student-master-migration.sql`** 파일을 Supabase SQL Editor에서 실행:

```sql
-- student_master 테이블 생성
-- 자동 동기화 트리거 설정
-- RLS 정책 적용
-- 기존 학생 데이터 동기화 (옵션)
```

### 2. 필수 패키지 설치

```bash
npm install xlsx
```

### 3. 관리자 메뉴 확인

관리자로 로그인 후 사이드바에서 **"학생 명단 관리"** 메뉴가 표시되는지 확인

---

## 📝 사용 방법

### 관리자 작업

#### 1. 학생 명단 엑셀 업로드
1. **학생 명단 관리** 페이지 접속
2. **템플릿 다운로드** 버튼 클릭
3. 엑셀 파일에 학생 번호와 이름 입력:
   ```
   번호    이름
   1      김철수
   2      이영희
   3      박민수
   ...
   ```
4. **파일 선택** 후 업로드
5. 업로드 결과 확인

#### 2. 가입 현황 모니터링
- 전체/가입완료/미가입 학생 수 확인
- 가입 진행률 모니터링
- 실시간 통계 업데이트

### 일반 사용자 작업

#### 1. 케이스 입력 시 학생 선택
- 드롭다운에서 학생 선택
- 가입된 학생: ✅ 체크 표시
- 미가입 학생: ❌ 표시 + 선택 시 안내 팝업

#### 2. 미가입 학생 선택 시
```
⚠️ 선택할 수 없는 학생
김철수님은 아직 회원가입을 하지 않아 선택할 수 없습니다.

해당 학생이 회원가입을 완료한 후 다시 시도해주세요.
또는 다른 학생을 선택해주세요.
```

---

## 🔄 자동 동기화 시스템

### 회원가입 시
- 학생이 회원가입 완료 → `student_master` 테이블 자동 업데이트
- `is_registered = TRUE`로 변경
- 즉시 모든 드롭다운에서 선택 가능

### 탈퇴 시
- 사용자 삭제 → `student_master`에서 등록 해제
- `is_registered = FALSE`로 변경

---

## 📊 기능 상세

### 새로운 컴포넌트

#### `StudentSelectorNew`
```tsx
<StudentSelectorNew
  value={selectedStudent}
  onValueChange={setSelectedStudent}
  placeholder="학생을 선택하세요"
  allowNone={true}  // "선택 안함" 옵션
  noneLabel="본인 (나)"  // 커스텀 라벨
/>
```

#### 주요 기능
- 실시간 가입 상태 표시
- 미가입 학생 선택 시 검증
- 친화적인 에러 메시지
- 새로고침 버튼

### 새로운 훅

#### `useStudentMaster()`
```tsx
const { studentOptions, loading, error, refreshStudents } = useStudentMaster()
```

#### `useStudentValidation()`
```tsx
const { validateStudent, getStudentId } = useStudentValidation()
```

---

## 🔧 기술적 세부사항

### 파일 구조
```
src/
├── utils/studentMasterManager.ts      # 핵심 로직
├── hooks/useStudentMaster.ts          # React 훅
├── components/StudentSelectorNew.tsx  # 새 선택 컴포넌트
├── app/dashboard/admin/student-list/  # 관리 페이지
└── supabase-student-master-migration.sql
```

### 데이터베이스 구조
```sql
student_master:
- id: UUID (PK)
- number: TEXT (UNIQUE) -- 학생 번호
- name: TEXT            -- 학생 이름
- is_registered: BOOLEAN -- 가입 여부
- registered_user_id: UUID (FK) -- 가입한 사용자 ID
- created_at, updated_at
```

---

## ✅ 테스트 체크리스트

### 관리자 테스트
- [ ] 학생 명단 관리 페이지 접속
- [ ] 템플릿 다운로드
- [ ] 엑셀 파일 업로드 (정상/오류 케이스)
- [ ] 통계 정보 표시 확인
- [ ] 새로고침 기능

### 학생 선택 테스트
- [ ] 케이스 입력에서 학생 선택
- [ ] 교환 페이지에서 학생 선택
- [ ] 양도 페이지에서 학생 선택
- [ ] 가입/미가입 학생 구분 표시
- [ ] 미가입 학생 선택 시 팝업

### 자동 동기화 테스트
- [ ] 새 학생 회원가입 후 드롭다운 확인
- [ ] 사용자 삭제 후 상태 변경 확인

---

## 🚨 주의사항

### 기존 시스템과 병행 운영
- 기존 `useStudentsHybrid` 시스템도 일부 페이지에서 사용 중
- 점진적 전환 예정
- 문제 발생 시 기존 시스템으로 롤백 가능

### Excel 파일 형식
- 첫 번째 컬럼: 번호 (필수)
- 두 번째 컬럼: 이름 (필수)
- 첫 번째 행: 헤더 (자동 제외됨)
- 빈 행은 자동으로 필터링

### 성능 고려사항
- 학생 수가 많아도 빠른 검색
- 클라이언트 사이드 캐싱
- 서버 부하 최소화

---

## 🔄 마이그레이션 후 정리 작업

전환이 완료되고 안정화된 후 다음 파일들을 정리할 예정:

```
제거 예정:
- useStudentsHybrid.ts
- useStudents.ts
- data/students.ts
- syncStudentData.ts
- 기존 StudentSelector.tsx

유지:
- useStudentMaster.ts
- studentMasterManager.ts
- StudentSelectorNew.tsx
```

---

## 📞 문제 해결

### 학생 목록이 비어있는 경우
1. 관리자가 학생 명단을 업로드했는지 확인
2. 브라우저 새로고침
3. "새로고침" 버튼 클릭

### 가입한 학생이 미가입으로 표시되는 경우
1. 해당 학생의 번호가 정확한지 확인
2. 대시보드에서 "통계 새로고침" 실행
3. SQL에서 수동 동기화: `SELECT sync_existing_students_to_master();`

### 업로드가 실패하는 경우
- Excel 파일 형식 확인 (.xlsx, .xls)
- 번호/이름 컬럼이 비어있지 않은지 확인
- 특수문자나 긴 이름 확인

---

## 🎉 기대 효과

✅ **관리 편의성**: 엑셀로 간편한 명단 관리
✅ **사용자 경험**: 친화적인 오류 안내
✅ **성능 향상**: 복잡한 캐싱 로직 제거
✅ **확장성**: 새 학년도 명단 쉽게 교체
✅ **안정성**: 자동 동기화로 데이터 일관성

---

**🚀 새로운 학생 관리 시스템으로 더욱 효율적인 케이스 관리를 경험하세요!**