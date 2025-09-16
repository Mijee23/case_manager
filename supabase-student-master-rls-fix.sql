-- 학생 마스터 테이블 RLS 정책 수정
-- 서비스 역할 키로 접근할 수 있도록 정책 업데이트
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Admin can manage student_master" ON public.student_master;
DROP POLICY IF EXISTS "Students and residents can read student_master" ON public.student_master;

-- 새로운 정책 생성 - 서비스 역할과 관리자 모두 허용
CREATE POLICY "Service role and admin can manage student_master" ON public.student_master
    FOR ALL USING (
        -- 서비스 역할로 접근하는 경우 (auth.role() = 'service_role') 또는
        -- 관리자 사용자로 접근하는 경우 허용
        auth.role() = 'service_role'
        OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = '관리자'
        )
    );

-- 학생과 전공의는 읽기만 가능 (기존과 동일하지만 서비스 역할도 허용)
CREATE POLICY "Service role and users can read student_master" ON public.student_master
    FOR SELECT USING (
        -- 서비스 역할로 접근하는 경우 또는
        -- 인증된 사용자가 학생이나 전공의인 경우 허용
        auth.role() = 'service_role'
        OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('학생', '전공의')
        )
    );

-- users 테이블도 서비스 역할이 접근할 수 있도록 정책 확인/수정
-- users 테이블의 기존 정책 조회 (확인용)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users';

-- users 테이블에 서비스 역할 접근 정책 추가
-- 기존 정책이 있다면 먼저 삭제
DROP POLICY IF EXISTS "Service role can access users" ON public.users;
CREATE POLICY "Service role can access users" ON public.users
    FOR ALL USING (auth.role() = 'service_role');

-- 정책 적용 확인
SELECT 'Student master RLS policies updated successfully!' as status;

-- 확인용 쿼리 (정책이 잘 적용되었는지 확인)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'student_master';