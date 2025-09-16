-- 학생 마스터 관리 시스템을 위한 데이터베이스 마이그레이션
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요

-- 1. student_master 테이블 생성
CREATE TABLE IF NOT EXISTS public.student_master (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_registered BOOLEAN DEFAULT FALSE,
    registered_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_student_master_number ON public.student_master(number);
CREATE INDEX IF NOT EXISTS idx_student_master_registered ON public.student_master(is_registered);
CREATE INDEX IF NOT EXISTS idx_student_master_user_id ON public.student_master(registered_user_id);

-- 3. RLS(Row Level Security) 활성화
ALTER TABLE public.student_master ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 생성
-- 관리자는 모든 데이터에 접근 가능
CREATE POLICY "Admin can manage student_master" ON public.student_master
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = '관리자'
        )
    );

-- 학생과 전공의는 읽기만 가능
CREATE POLICY "Students and residents can read student_master" ON public.student_master
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('학생', '전공의')
        )
    );

-- 5. 사용자 회원가입 시 student_master 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_student_master_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    -- 새 사용자가 학생이고 번호가 있는 경우 student_master 업데이트
    IF NEW.role = '학생' AND NEW.number IS NOT NULL THEN
        UPDATE public.student_master
        SET
            is_registered = TRUE,
            registered_user_id = NEW.id,
            updated_at = now()
        WHERE number = NEW.number;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 사용자 삽입/업데이트 시 트리거
DROP TRIGGER IF EXISTS trigger_update_student_master_on_signup ON public.users;
CREATE TRIGGER trigger_update_student_master_on_signup
    AFTER INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_student_master_on_signup();

-- 7. 사용자 삭제 시 student_master 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_student_master_on_user_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- 삭제된 사용자가 학생인 경우 student_master에서 등록 해제
    IF OLD.role = '학생' AND OLD.number IS NOT NULL THEN
        UPDATE public.student_master
        SET
            is_registered = FALSE,
            registered_user_id = NULL,
            updated_at = now()
        WHERE number = OLD.number;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 사용자 삭제 시 트리거
DROP TRIGGER IF EXISTS trigger_update_student_master_on_user_delete ON public.users;
CREATE TRIGGER trigger_update_student_master_on_user_delete
    AFTER DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_student_master_on_user_delete();

-- 9. 기존 users 테이블의 학생들을 student_master에 동기화하는 함수
CREATE OR REPLACE FUNCTION sync_existing_students_to_master()
RETURNS VOID AS $$
DECLARE
    student_record RECORD;
BEGIN
    -- 모든 기존 학생을 student_master에 추가/업데이트
    FOR student_record IN
        SELECT id, number, name FROM public.users WHERE role = '학생'
    LOOP
        INSERT INTO public.student_master (number, name, is_registered, registered_user_id)
        VALUES (student_record.number, student_record.name, TRUE, student_record.id)
        ON CONFLICT (number) DO UPDATE SET
            name = EXCLUDED.name,
            is_registered = TRUE,
            registered_user_id = EXCLUDED.registered_user_id,
            updated_at = now();
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 10. 기존 데이터 동기화 실행
-- 기존 사용자가 있는 경우 자동으로 동기화
SELECT sync_existing_students_to_master();

-- 11. 테이블 코멘트 추가
COMMENT ON TABLE public.student_master IS '학생 마스터 데이터 - 엑셀 업로드로 관리되는 전체 학생 명단';
COMMENT ON COLUMN public.student_master.number IS '학생 번호 (고유)';
COMMENT ON COLUMN public.student_master.name IS '학생 이름';
COMMENT ON COLUMN public.student_master.is_registered IS '회원가입 여부';
COMMENT ON COLUMN public.student_master.registered_user_id IS '가입된 사용자 ID (FK)';

-- 12. 관리자용 학생 마스터 통계 뷰
CREATE OR REPLACE VIEW public.student_master_stats AS
SELECT
    COUNT(*) as total_students,
    COUNT(CASE WHEN is_registered THEN 1 END) as registered_students,
    COUNT(CASE WHEN NOT is_registered THEN 1 END) as unregistered_students,
    ROUND(
        COUNT(CASE WHEN is_registered THEN 1 END)::DECIMAL / COUNT(*) * 100, 2
    ) as registration_percentage
FROM public.student_master;

-- 13. 뷰에 대한 RLS 정책
ALTER VIEW public.student_master_stats SET (security_invoker = true);

-- 마이그레이션 완료
SELECT 'Student master system migration completed successfully!' as status;

-- 사용법 예시:
-- 1. 관리자가 엑셀 파일로 학생 명단 업로드
-- 2. 학생이 회원가입하면 자동으로 is_registered = TRUE로 업데이트
-- 3. 케이스 배정 시 student_master에서 학생 목록 조회
-- 4. 미가입 학생 선택 시 친화적인 에러 메시지 표시