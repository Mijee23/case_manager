import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // WSL2 파일 시스템 감시 문제 해결
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000, // 1초마다 폴링
        aggregateTimeout: 300,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/dist/**'
        ]
      };
    }
    return config;
  },

  // 실험적 기능 설정
  experimental: {
    // Turbopack 관련 문제 완화
    turbo: {
      rules: {
        // 파일 감시 최적화
        '*.js': ['babel-loader'],
        '*.ts': ['babel-loader'],
        '*.tsx': ['babel-loader']
      }
    }
  },

  // 개발 서버 설정
  devIndicators: {
    appIsrStatus: false, // ISR 상태 표시기 비활성화
  }
};

export default nextConfig;
