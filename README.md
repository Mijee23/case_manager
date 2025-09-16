# 치과 케이스 관리 시스템

Next.js + Supabase로 구축된 실시간 의료 케이스 관리 웹사이트입니다.

## 🚀 기능

### 사용자 역할
- **학생**: 케이스 입력/수정/교환/양도
- **관리자**: 전체 관리 + 엑셀 업로드 + 대시보드
- **전공의**: 읽기 전용 뷰어

### 주요 기능
- ✅ 실시간 케이스 동기화
- ✅ 역할별 권한 관리
- ✅ 케이스 1:1 교환 및 양도
- ✅ 엑셀 파일 일괄 업로드
- ✅ 관리자 대시보드 및 통계
- ✅ 반응형 디자인

## 🛠️ 기술 스택

- **Frontend/Backend**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL + Realtime)
- **인증**: Supabase Auth
- **UI**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Excel**: SheetJS

## 📋 사전 요구사항

- Node.js 18+
- npm 또는 yarn
- Supabase 계정

## 🚀 시작하기

### 1. 저장소 클론 및 의존성 설치

```bash
cd case-manager
npm install
```

### 2. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. 프로젝트 이름: `case-manager`
3. 데이터베이스 비밀번호 설정
4. 리전 선택 (Korea 권장)

### 3. 환경변수 설정

`.env.local` 파일을 생성하고 Supabase 대시보드의 Settings > API에서 값을 복사:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. 데이터베이스 스키마 설정

Supabase SQL Editor에서 `supabase-setup.md` 파일의 SQL 스크립트를 실행하세요.

### 5. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000에서 애플리케이션을 확인할 수 있습니다.

## 📊 데이터베이스 구조

### 테이블
- **users**: 사용자 정보 (id, email, number, name, role)
- **cases**: 케이스 정보 (환자, 담당자, 상태 등)
- **patients**: 환자 정보 (번호, 이름)

### 주요 기능
- Row Level Security (RLS) 적용
- 실시간 구독 활성화
- 자동 사용자 생성 트리거

## 🔐 인증 및 권한

- 이메일/번호/이름/비밀번호로 회원가입
- 역할별 접근 제어 (학생/관리자/전공의)
- 미들웨어를 통한 라우트 보호

## 📱 화면별 기능

### 공통
- **전체 케이스**: 모든 케이스 조회 및 필터링
- **My Page**: 개인정보 수정, 비밀번호 변경

### 학생 전용
- **My Cases**: 분류별 케이스 관리 및 상태 업데이트
- **케이스 입력**: 새 케이스 등록
- **케이스 교환**: 1:1 케이스 교환
- **케이스 양도**: 다른 학생에게 케이스 양도

### 관리자 전용
- **대시보드**: 통계 및 차트
- **엑셀 업로드**: 일괄 케이스 등록
- **사용자 관리**: 전체 사용자 관리

### 전공의 전용
- **담당 케이스**: 본인 담당 케이스만 조회

## 🔄 실시간 기능

Supabase Realtime을 사용하여 다음 상황에서 자동 업데이트:
- 케이스 상태 변경
- 새 케이스 생성
- 케이스 교환/양도

## 📁 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── auth/              # 인증 페이지
│   └── dashboard/         # 메인 대시보드
├── components/            # 재사용 컴포넌트
│   ├── auth/             # 인증 관련
│   ├── layout/           # 레이아웃
│   └── ui/               # shadcn/ui 컴포넌트
├── hooks/                # 커스텀 훅
├── lib/                  # 유틸리티
└── types/                # TypeScript 타입 정의
```

## 🚀 배포

### Vercel 배포 (권장)

1. GitHub에 코드 푸시
2. [Vercel](https://vercel.com)에서 프로젝트 가져오기
3. 환경변수 설정
4. 배포

## 🔧 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 빌드 후 실행
npm start

# 린트 체크
npm run lint
```

## 📝 엑셀 업로드 양식

관리자는 다음 컬럼을 포함한 엑셀 파일을 업로드할 수 있습니다:

- 예약일시
- 예약시간
- 진료번호
- 환자명
- 예약의사
- 진료내역
- 분류 (가철/고정/임플/임수)

## 🤝 기여

1. 이슈 생성
2. 기능 브랜치 생성
3. 커밋 후 푸시
4. Pull Request 생성

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

## 🆘 문제해결

### 일반적인 문제

1. **Supabase 연결 실패**: `.env.local` 파일의 환경변수 확인
2. **권한 오류**: RLS 정책이 올바르게 설정되었는지 확인
3. **실시간 업데이트 안됨**: Supabase에서 Realtime이 활성화되었는지 확인

### 로그 확인

```bash
# 개발 서버 로그
npm run dev

# 브라우저 콘솔에서 실시간 업데이트 로그 확인
```

## 📞 지원

문제가 발생하면 GitHub Issues를 통해 문의해주세요.