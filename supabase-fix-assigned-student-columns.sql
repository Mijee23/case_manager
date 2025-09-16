-- assigned_student 컬럼 타입 수정
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요

-- 현재 컬럼 타입 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cases'
AND column_name IN ('assigned_student1', 'assigned_student2');

-- 만약 컬럼이 text[] 타입으로 되어 있다면, UUID 타입으로 변경
-- 주의: 기존 데이터가 있다면 백업 후 실행하세요

-- Step 1: 임시 컬럼 생성
ALTER TABLE public.cases ADD COLUMN assigned_student1_temp UUID;
ALTER TABLE public.cases ADD COLUMN assigned_student2_temp UUID;

-- Step 2: 기존 데이터 마이그레이션 (만약 데이터가 있다면)
-- 기존 데이터가 UUID 문자열 형태라면:
-- UPDATE public.cases SET assigned_student1_temp = assigned_student1::UUID WHERE assigned_student1 IS NOT NULL;
-- UPDATE public.cases SET assigned_student2_temp = assigned_student2::UUID WHERE assigned_student2 IS NOT NULL;

-- Step 3: 기존 컬럼 삭제
ALTER TABLE public.cases DROP COLUMN assigned_student1;
ALTER TABLE public.cases DROP COLUMN assigned_student2;

-- Step 4: 임시 컬럼 이름 변경
ALTER TABLE public.cases RENAME COLUMN assigned_student1_temp TO assigned_student1;
ALTER TABLE public.cases RENAME COLUMN assigned_student2_temp TO assigned_student2;

-- Step 5: 외래 키 제약 조건 추가
ALTER TABLE public.cases
ADD CONSTRAINT fk_cases_assigned_student1
FOREIGN KEY (assigned_student1) REFERENCES public.users(id);

ALTER TABLE public.cases
ADD CONSTRAINT fk_cases_assigned_student2
FOREIGN KEY (assigned_student2) REFERENCES public.users(id);

-- Step 6: RLS 정책 업데이트 (필요한 경우)
-- 기존 정책을 확인하고 필요시 재생성

-- 확인 쿼리
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cases'
AND column_name IN ('assigned_student1', 'assigned_student2');

SELECT 'assigned_student columns fixed!' as status;