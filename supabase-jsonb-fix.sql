-- JSONB change_log 업데이트를 위한 RPC 함수들
-- Supabase SQL Editor에서 실행

-- 1. 케이스 change_log 업데이트 함수
CREATE OR REPLACE FUNCTION update_case_changelog(
    case_id UUID,
    new_changelog JSONB
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.cases
    SET change_log = new_changelog
    WHERE id = case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. change_log에 새 항목 추가 함수 (더 안전한 방법)
CREATE OR REPLACE FUNCTION append_to_case_changelog(
    case_id UUID,
    new_entry JSONB
)
RETURNS VOID AS $$
DECLARE
    current_log JSONB;
BEGIN
    -- 현재 change_log 가져오기
    SELECT change_log INTO current_log
    FROM public.cases
    WHERE id = case_id;

    -- NULL이거나 빈 배열인 경우 처리
    IF current_log IS NULL OR current_log = 'null'::jsonb THEN
        current_log = '[]'::jsonb;
    END IF;

    -- 새 항목 추가
    UPDATE public.cases
    SET change_log = current_log || jsonb_build_array(new_entry)
    WHERE id = case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 권한 설정 (필요한 경우)
-- GRANT EXECUTE ON FUNCTION update_case_changelog TO authenticated;
-- GRANT EXECUTE ON FUNCTION append_to_case_changelog TO authenticated;

-- 테스트용 쿼리 (선택사항)
-- SELECT 'JSONB functions created successfully!' as status;