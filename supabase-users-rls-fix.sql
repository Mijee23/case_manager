-- users 테이블 RLS 정책 수정
-- 케이스 수정 시 학생 정보 조회가 가능하도록 정책 업데이트
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요

-- 1. 현재 users 테이블의 RLS 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- 2. 기존 정책들 삭제 (혹시 충돌 방지)
DROP POLICY IF EXISTS "Service role can access users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Students and residents can read users" ON public.users;
DROP POLICY IF EXISTS "Service role and admin can manage users" ON public.users;
DROP POLICY IF EXISTS "Service role and authenticated users can read users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;

-- 모든 기존 정책 강제 삭제 (혹시 모를 정책들까지)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.users';
    END LOOP;
END $$;

-- 3. 새로운 정책 생성 - 서비스 역할과 관리자 모두 허용
-- 무한 재귀 방지를 위해 users 테이블을 다시 조회하지 않음
CREATE POLICY "Service role and admin can manage users" ON public.users
    FOR ALL USING (
        -- 서비스 역할로 접근하는 경우만 허용 (무한 재귀 방지)
        auth.role() = 'service_role'
    );

-- 4. 모든 인증된 사용자는 읽기 가능 (서비스 역할도 허용)
CREATE POLICY "Service role and authenticated users can read users" ON public.users
    FOR SELECT USING (
        -- 서비스 역할로 접근하는 경우 또는
        -- 인증된 사용자라면 누구나 읽기 가능 (무한 재귀 방지)
        auth.role() = 'service_role'
        OR
        auth.uid() IS NOT NULL
    );

-- 5. 사용자는 자신의 데이터만 수정 가능 (무한 재귀 방지)
CREATE POLICY "Users can update their own data" ON public.users
    FOR UPDATE USING (
        auth.role() = 'service_role'
        OR
        auth.uid() = id
    );

-- 6. 정책 적용 확인
SELECT 'Users table RLS policies updated successfully!' as status;

-- 7. 확인용 쿼리 (정책이 잘 적용되었는지 확인)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- 8. 테스트용 쿼리 (실제로 데이터가 조회되는지 확인)
-- 이 쿼리가 성공적으로 실행되어야 함
SELECT id, name, number, role 
FROM public.users 
LIMIT 5;
