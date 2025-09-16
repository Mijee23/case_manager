-- 케이스 교환을 위한 RLS 정책 수정
-- 모든 인증된 사용자가 케이스를 수정할 수 있도록 UPDATE 정책 변경
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요

-- 1. 현재 cases 테이블의 UPDATE 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'cases' AND cmd = 'UPDATE'
ORDER BY policyname;

-- 2. 기존 UPDATE 정책 삭제
DROP POLICY IF EXISTS "Students can update their assigned cases, admins can update all" ON public.cases;

-- 3. 새로운 UPDATE 정책 생성 - 모든 인증된 사용자가 케이스 수정 가능
CREATE POLICY "Authenticated users can update any case for exchange" ON public.cases
    FOR UPDATE USING (
        auth.role() = 'service_role'
        OR
        auth.uid() IS NOT NULL  -- 모든 인증된 사용자가 수정 가능
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR
        auth.uid() IS NOT NULL  -- 모든 인증된 사용자가 수정 가능
    );

-- 4. 정책 적용 확인
SELECT 'Case exchange RLS policy updated successfully!' as status;

-- 5. 확인용 쿼리 (UPDATE 정책이 잘 적용되었는지 확인)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'cases' AND cmd = 'UPDATE'
ORDER BY policyname;