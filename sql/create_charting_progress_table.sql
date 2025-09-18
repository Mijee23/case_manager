-- 차팅 현황 테이블 생성
CREATE TABLE IF NOT EXISTS charting_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    charting_count INTEGER DEFAULT 0 NOT NULL,
    diagnosis_total_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- 한 사용자당 하나의 기록만 허용
    UNIQUE(user_id)
);

-- updated_at 자동 업데이트 트리거 함수 생성 (이미 있다면 건너뜀)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 자동 업데이트 트리거 생성
CREATE TRIGGER update_charting_progress_updated_at
    BEFORE UPDATE ON charting_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) 설정
ALTER TABLE charting_progress ENABLE ROW LEVEL SECURITY;

-- 정책 생성: 학생은 자신의 데이터만 조회/수정 가능
CREATE POLICY "Students can view own charting progress" ON charting_progress
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Students can insert own charting progress" ON charting_progress
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can update own charting progress" ON charting_progress
    FOR UPDATE USING (auth.uid() = user_id);

-- 정책 생성: 관리자는 모든 데이터 조회 가능
CREATE POLICY "Admins can view all charting progress" ON charting_progress
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = '관리자'
        )
    );

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_charting_progress_user_id ON charting_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_charting_progress_updated_at ON charting_progress(updated_at DESC);