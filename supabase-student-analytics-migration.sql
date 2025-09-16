-- 학생 케이스 분석 기능을 위한 users 테이블 업데이트
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요

-- 1. users 테이블에 케이스 수 컬럼들 추가
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS case_count_가철 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS case_count_고정 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS case_count_임플 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS case_count_임수 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_case_sync TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 2. 기존 학생들의 케이스 수를 계산하여 업데이트하는 함수
CREATE OR REPLACE FUNCTION sync_student_case_counts()
RETURNS VOID AS $$
DECLARE
    student_record RECORD;
    case_counts RECORD;
BEGIN
    -- 모든 학생에 대해 반복
    FOR student_record IN
        SELECT id FROM public.users WHERE role = '학생'
    LOOP
        -- 해당 학생의 분류별 케이스 수 계산
        SELECT
            COALESCE(SUM(CASE WHEN category = '가철' THEN 1 ELSE 0 END), 0) as 가철_count,
            COALESCE(SUM(CASE WHEN category = '고정' THEN 1 ELSE 0 END), 0) as 고정_count,
            COALESCE(SUM(CASE WHEN category = '임플' THEN 1 ELSE 0 END), 0) as 임플_count,
            COALESCE(SUM(CASE WHEN category = '임수' THEN 1 ELSE 0 END), 0) as 임수_count,
            COUNT(*) as total_count
        INTO case_counts
        FROM public.cases
        WHERE assigned_student1 = student_record.id OR assigned_student2 = student_record.id;

        -- users 테이블 업데이트
        UPDATE public.users
        SET
            case_count_가철 = case_counts.가철_count,
            case_count_고정 = case_counts.고정_count,
            case_count_임플 = case_counts.임플_count,
            case_count_임수 = case_counts.임수_count,
            total_cases = case_counts.total_count,
            last_case_sync = now()
        WHERE id = student_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. 케이스 변경 시 자동으로 학생 케이스 수를 업데이트하는 트리거 함수
CREATE OR REPLACE FUNCTION update_student_case_counts_on_case_change()
RETURNS TRIGGER AS $$
DECLARE
    affected_students UUID[];
    student_id UUID;
    case_counts RECORD;
BEGIN
    -- 영향받는 학생 ID들 수집
    affected_students := ARRAY[]::UUID[];

    -- 새로운 학생들 추가 (INSERT 또는 UPDATE의 경우)
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.assigned_student1 IS NOT NULL THEN
            affected_students := array_append(affected_students, NEW.assigned_student1);
        END IF;
        IF NEW.assigned_student2 IS NOT NULL THEN
            affected_students := array_append(affected_students, NEW.assigned_student2);
        END IF;
    END IF;

    -- 이전 학생들 추가 (UPDATE 또는 DELETE의 경우)
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        IF OLD.assigned_student1 IS NOT NULL THEN
            affected_students := array_append(affected_students, OLD.assigned_student1);
        END IF;
        IF OLD.assigned_student2 IS NOT NULL THEN
            affected_students := array_append(affected_students, OLD.assigned_student2);
        END IF;
    END IF;

    -- 중복 제거
    affected_students := ARRAY(SELECT DISTINCT unnest(affected_students));

    -- 각 영향받는 학생의 케이스 수 업데이트
    FOREACH student_id IN ARRAY affected_students
    LOOP
        SELECT
            COALESCE(SUM(CASE WHEN category = '가철' THEN 1 ELSE 0 END), 0) as 가철_count,
            COALESCE(SUM(CASE WHEN category = '고정' THEN 1 ELSE 0 END), 0) as 고정_count,
            COALESCE(SUM(CASE WHEN category = '임플' THEN 1 ELSE 0 END), 0) as 임플_count,
            COALESCE(SUM(CASE WHEN category = '임수' THEN 1 ELSE 0 END), 0) as 임수_count,
            COUNT(*) as total_count
        INTO case_counts
        FROM public.cases
        WHERE (assigned_student1 = student_id OR assigned_student2 = student_id);

        UPDATE public.users
        SET
            case_count_가철 = case_counts.가철_count,
            case_count_고정 = case_counts.고정_count,
            case_count_임플 = case_counts.임플_count,
            case_count_임수 = case_counts.임수_count,
            total_cases = case_counts.total_count,
            last_case_sync = now()
        WHERE id = student_id AND role = '학생';
    END LOOP;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_student_case_counts ON public.cases;
CREATE TRIGGER trigger_update_student_case_counts
    AFTER INSERT OR UPDATE OR DELETE ON public.cases
    FOR EACH ROW
    EXECUTE FUNCTION update_student_case_counts_on_case_change();

-- 5. 기존 데이터에 대해 초기 동기화 실행
SELECT sync_student_case_counts();

-- 6. RLS(Row Level Security) 정책 업데이트 (필요한 경우)
-- 학생들이 자신의 케이스 통계를 볼 수 있도록 허용
-- 이미 users 테이블에 대한 적절한 RLS 정책이 있다고 가정

COMMENT ON COLUMN public.users.case_count_가철 IS '학생이 소유한 가철 케이스 수';
COMMENT ON COLUMN public.users.case_count_고정 IS '학생이 소유한 고정 케이스 수';
COMMENT ON COLUMN public.users.case_count_임플 IS '학생이 소유한 임플 케이스 수';
COMMENT ON COLUMN public.users.case_count_임수 IS '학생이 소유한 임수 케이스 수';
COMMENT ON COLUMN public.users.total_cases IS '학생이 소유한 총 케이스 수';
COMMENT ON COLUMN public.users.last_case_sync IS '마지막 케이스 수 동기화 시간';

-- 마이그레이션 완료
SELECT 'Student analytics migration completed successfully!' as status;