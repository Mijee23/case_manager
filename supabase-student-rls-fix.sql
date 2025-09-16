-- 학생이 케이스 테이블을 수정할 수 있도록 RLS 정책 수정
-- 케이스 양도, 교환, 상태 변경 등이 가능하도록 정책 업데이트
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요

-- 1. 현재 cases 테이블의 RLS 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'cases'
ORDER BY policyname;

-- 2. 기존 정책들 삭제 (학생 관련 정책만 선별적으로 삭제)
-- 관리자 정책은 유지하고 학생 관련 정책만 수정
DROP POLICY IF EXISTS "Cases are viewable by assigned students and admins" ON public.cases;
DROP POLICY IF EXISTS "Cases are updatable by assigned students and admins" ON public.cases;
DROP POLICY IF EXISTS "Students can view their assigned cases" ON public.cases;
DROP POLICY IF EXISTS "Students and admins can view cases" ON public.cases;
DROP POLICY IF EXISTS "Authenticated users can view cases" ON public.cases;
DROP POLICY IF EXISTS "Students can update their assigned cases, admins can update all" ON public.cases;
DROP POLICY IF EXISTS "Students can insert their assigned cases, admins can insert all" ON public.cases;
DROP POLICY IF EXISTS "Students can delete their assigned cases, admins can delete all" ON public.cases;

-- 3. 새로운 정책 생성 - 학생도 케이스 수정 가능
-- 모든 인증된 사용자는 케이스 조회 가능
CREATE POLICY "Authenticated users can view cases" ON public.cases
    FOR SELECT USING (
        auth.role() = 'service_role'
        OR
        auth.uid() IS NOT NULL
    );

-- 학생은 자신이 배정된 케이스 수정 가능, 관리자는 모든 케이스 수정 가능
-- 케이스 양도/교환을 위해 더 유연한 정책 적용
CREATE POLICY "Students can update their assigned cases, admins can update all" ON public.cases
    FOR UPDATE USING (
        auth.role() = 'service_role'
        OR
        -- 관리자는 모든 케이스 수정 가능
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = '관리자'
        )
        OR
        -- 학생은 자신이 배정된 케이스만 수정 가능
        (
            assigned_student1 = auth.uid() 
            OR assigned_student2 = auth.uid()
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR
        -- 관리자는 모든 케이스 수정 가능
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = '관리자'
        )
        OR
        -- 학생은 자신이 배정된 케이스만 수정 가능
        -- 양도/교환 시에는 기존 권한을 유지
        (
            assigned_student1 = auth.uid() 
            OR assigned_student2 = auth.uid()
        )
        OR
        -- 케이스 양도/교환을 위해 임시로 더 넓은 권한 허용
        -- (인증된 사용자라면 누구나 수정 가능하도록)
        auth.uid() IS NOT NULL
    );

-- 학생은 자신이 배정된 케이스 삽입 가능, 관리자는 모든 케이스 삽입 가능
CREATE POLICY "Students can insert their assigned cases, admins can insert all" ON public.cases
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role'
        OR
        -- 관리자는 모든 케이스 삽입 가능
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = '관리자'
        )
        OR
        -- 학생은 자신이 배정된 케이스만 삽입 가능
        (
            assigned_student1 = auth.uid() 
            OR assigned_student2 = auth.uid()
        )
    );

-- 학생은 자신이 배정된 케이스 삭제 가능, 관리자는 모든 케이스 삭제 가능
CREATE POLICY "Students can delete their assigned cases, admins can delete all" ON public.cases
    FOR DELETE USING (
        auth.role() = 'service_role'
        OR
        -- 관리자는 모든 케이스 삭제 가능
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = '관리자'
        )
        OR
        -- 학생은 자신이 배정된 케이스만 삭제 가능
        (
            assigned_student1 = auth.uid() 
            OR assigned_student2 = auth.uid()
        )
    );

-- 4. student_master 테이블도 학생이 읽을 수 있도록 정책 확인/수정
-- student_master 테이블의 기존 정책 조회
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'student_master'
ORDER BY policyname;

-- student_master 테이블 정책이 없다면 생성
DROP POLICY IF EXISTS "Service role and users can read student_master" ON public.student_master;
DROP POLICY IF EXISTS "Service role and admin can manage student_master" ON public.student_master;
DROP POLICY IF EXISTS "Authenticated users can read student_master" ON public.student_master;

CREATE POLICY "Authenticated users can read student_master" ON public.student_master
    FOR SELECT USING (
        auth.role() = 'service_role'
        OR
        auth.uid() IS NOT NULL
    );

CREATE POLICY "Service role and admin can manage student_master" ON public.student_master
    FOR ALL USING (
        auth.role() = 'service_role'
        OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = '관리자'
        )
    );

-- 5. 정책 적용 확인
SELECT 'Student RLS policies updated successfully!' as status;

-- 6. 확인용 쿼리 (정책이 잘 적용되었는지 확인)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'cases'
ORDER BY policyname;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'student_master'
ORDER BY policyname;
