-- 간단한 컬럼 타입 수정 (개발환경용)
-- Supabase SQL Editor에서 실행하세요

-- 1. 현재 컬럼 상태 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'cases'
AND column_name IN ('assigned_student1', 'assigned_student2')
ORDER BY column_name;

-- 2. RLS 정책 확인
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'cases'
AND (qual LIKE '%assigned_student1%' OR qual LIKE '%assigned_student2%');

-- 3. 의존하는 RLS 정책들 삭제
DROP POLICY IF EXISTS "Cases are updatable by assigned students and admins" ON public.cases;
DROP POLICY IF EXISTS "Cases are viewable by assigned students and admins" ON public.cases;
DROP POLICY IF EXISTS "Students can view their assigned cases" ON public.cases;
DROP POLICY IF EXISTS "Students and admins can view cases" ON public.cases;

-- 4. 기존 컬럼 삭제 (CASCADE 사용)
ALTER TABLE public.cases DROP COLUMN IF EXISTS assigned_student1 CASCADE;
ALTER TABLE public.cases DROP COLUMN IF EXISTS assigned_student2 CASCADE;

-- 3. UUID 타입으로 새 컬럼 생성
ALTER TABLE public.cases ADD COLUMN assigned_student1 UUID;
ALTER TABLE public.cases ADD COLUMN assigned_student2 UUID;

-- 4. 외래 키 제약 조건 추가
ALTER TABLE public.cases
ADD CONSTRAINT fk_cases_assigned_student1
FOREIGN KEY (assigned_student1) REFERENCES public.users(id)
ON DELETE SET NULL;

ALTER TABLE public.cases
ADD CONSTRAINT fk_cases_assigned_student2
FOREIGN KEY (assigned_student2) REFERENCES public.users(id)
ON DELETE SET NULL;

-- 5. 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_cases_assigned_student1 ON public.cases(assigned_student1);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_student2 ON public.cases(assigned_student2);

-- 6. RLS 정책 재생성
CREATE POLICY "Cases are viewable by assigned students and admins" ON public.cases
    FOR SELECT USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = '관리자'
        ) OR
        assigned_student1 = auth.uid() OR
        assigned_student2 = auth.uid()
    );

CREATE POLICY "Cases are updatable by assigned students and admins" ON public.cases
    FOR UPDATE USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = '관리자'
        ) OR
        assigned_student1 = auth.uid() OR
        assigned_student2 = auth.uid()
    );

-- 7. 관리자용 모든 권한 정책
CREATE POLICY "Admins can do everything with cases" ON public.cases
    FOR ALL USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = '관리자'
        )
    );

-- 8. 최종 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cases'
AND column_name IN ('assigned_student1', 'assigned_student2')
ORDER BY column_name;

-- RLS 정책 확인
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'cases'
ORDER BY policyname;

SELECT 'assigned_student columns fixed to UUID type and RLS policies restored!' as status;