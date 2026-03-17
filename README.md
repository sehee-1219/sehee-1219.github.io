# sehee-1219.github.io

브라우저에서 Supabase를 연결한 GitHub Pages 정적 사이트이며, 간단한 게시판 기능이 포함되어 있습니다.

## 추가된 내용

- [script.js](./script.js)에 Supabase 클라이언트 초기화 추가
- [index.html](./index.html)에 회원가입, 로그인, 로그아웃 UI 추가
- `board_posts` 테이블을 사용하는 게시판 UI 추가
- [supabase-board.sql](./supabase-board.sql) 설정 파일 추가

## 확인할 Supabase 설정

- 프로젝트 URL: `https://fppakfwjnflpraokazvq.supabase.co`
- 기존 `anon` 공개 키는 `script.js` 에 저장되어 있음
- `service_role` 키는 저장소나 클라이언트 코드에 넣지 않기
- 게시판 테스트 전 `supabase-board.sql` 을 Supabase SQL Editor에서 실행하기
- Supabase Auth > URL Configuration 에서 `Site URL` 을 `https://sehee-1219.github.io/` 로 설정하기
- Supabase Auth > URL Configuration 에서 `Additional Redirect URLs` 에 `https://sehee-1219.github.io/` 추가하기
- 사용자가 글을 쓰게 하려면 이메일/비밀번호 인증 켜기

## 로컬 미리보기

```powershell
py -m http.server 8000
```

그다음 `http://localhost:8000` 을 열면 됩니다.

## 배포

기본 브랜치에 push 하면 GitHub Pages가 루트의 `index.html` 을 배포합니다.
