# App Store Connect 제출 준비

steppY iOS 1.0 제출에 필요한 입력값을 한 곳에 모았다. 앱 안에서 고칠 수 있는 것은
이미 코드에 반영돼 있고, 여기 있는 건 **App Store Connect 웹에 사람이 직접 넣어야
하는 값**과 **아직 남은 수동 작업**이다.

---

## 1. 스크린샷

`store/screenshots-6.9/` — 1320 × 2868 (6.9인치, iPhone 17 Pro Max). App Store가
요구하는 유일한 필수 사이즈다. 다른 크기는 이걸 자동으로 줄여 쓴다.

| 파일 | 화면 |
| --- | --- |
| `01-intro.png` | 랜딩 — "교환학생 준비, steppY로 한번에" |
| `02-home.png` | 홈 — 진행 단계 · 오늘의 할 일 · 지망 학교 |
| `03-search.png` | 학교 찾기 — 271개 파견교, 성적 입력 판정 |
| `04-school-detail.png` | 학교 상세 — 지원 가능 판정 · 지도 · 기후 |
| `05-credits.png` | 학점 인정 — 전공별 유사 과목 |

시뮬레이터에서 실제 빌드를 띄워 찍은 화면이다. 마케팅 문구를 얹고 싶으면 이 원본
위에 올리면 되고, 그대로 올려도 심사에는 문제없다.

다시 찍는 법:

```bash
xcrun simctl io "iPhone 17 Pro Max" screenshot --type=png 01-intro.png
```

---

## 2. 앱 정보

**이름 (30자)**

    steppY — 교환학생 준비

**부제 (30자)**

    파견교 찾기부터 학점 인정까지

**프로모션 텍스트 (170자, 심사 없이 언제든 교체 가능)**

    2027-1 파견대학 원본 자료를 그대로 담았어요. 내 학점·어학 점수로 지원 가능한
    학교만 걸러 보고, 준비 일정과 학점 인정까지 한 앱에서 이어서 확인하세요.

**설명 (4000자 한도)**

    교환학생 준비는 정보가 흩어져 있어서 어렵습니다. 파견교 목록은 PDF에,
    지원 자격은 공지사항에, 학점 인정은 선배 카톡에 있습니다. steppY는 그걸
    한 앱에 모았습니다.

    ■ 내 성적으로 지원 가능한 학교만
    271개 파견교를 학점·어학 기준으로 걸러 지원 가능한 곳만 봅니다.
    국가·전공·기후·치안·상권으로 더 좁힐 수도 있어요.

    ■ 다녀와서 학점으로 인정될까?
    연세대 76개 전공을 기준으로 파견교의 유사 과목을 찾아 줍니다.
    과목코드·학점·관련 키워드까지 함께 보여 주니 출국 전에 미리 확인할 수 있어요.

    ■ 학교를 정하면 준비할 것들이 정리됩니다
    비자·서류 체크리스트와 마감, 32개국 통신·보험·계좌 개설 정보,
    오늘 할 일까지 그 학교 기준으로 맞춰 드려요.

    ■ 교환 기간의 기록
    사진과 한 줄을 남기면 그날의 도시와 날씨, 듣던 노래가 함께 저장됩니다.
    돌아와서 교환보고서를 쓸 때 그대로 재료가 됩니다.

    ■ 연세대학교 재학생 전용
    @yonsei.ac.kr 메일로만 가입할 수 있습니다.

    2027-1 파견대학 원본 자료를 옮겨 담았습니다. 학교의 공식 서비스가 아니며,
    최종 지원 요건은 반드시 국제처 공지를 확인해 주세요.

**키워드 (100자, 쉼표 구분, 공백 없이)**

    교환학생,연세대,파견교,어학연수,교환,유학,학점인정,전공매칭,국제처,워홀,해외대학,지원자격

**카테고리** — 기본: 교육(Education) / 보조: 여행(Travel)

**연령 등급** — 만 4세 이상. 폭력·성적 콘텐츠·도박·약물 항목 모두 "없음",
사용자 생성 콘텐츠 없음(기록은 본인만 보고 공유 기능이 없다), 웹 브라우징 기능 없음.

**저작권** — `2026 steppY`

---

## 3. App Privacy (데이터 수집 신고)

`js/analytics.js`가 `click_events`에, 나머지는 로그인한 계정 아래 쌓인다.
아래 표 그대로 App Store Connect의 App Privacy에 답하면 된다.
근거는 [privacy.html](../privacy.html)과 같다.

| 항목 | 수집 | 용도 | 신원 연결 | 추적 |
| --- | --- | --- | --- | --- |
| 이메일 주소 | 예 | 앱 기능(로그인) | 예 | 아니오 |
| 이름 | 예(선택) | 앱 기능 | 예 | 아니오 |
| 정확한 위치 | 예 | 앱 기능(기록의 도시·날씨) | 예 | 아니오 |
| 사진 | 예 | 앱 기능(기록에 첨부) | 예 | 아니오 |
| 기타 사용자 콘텐츠 | 예 | 앱 기능(기록 본문·태그) | 예 | 아니오 |
| 기타 데이터(학점·어학 성적·전공) | 예 | 앱 기능(지원 가능 판정) | 예 | 아니오 |
| 제품 상호 작용 | 예 | 분석 | **아니오** | 아니오 |
| 진단(충돌·성능) | 아니오 | — | — | — |

- **추적(Tracking)은 전 항목 "아니오"** — 광고 네트워크에 넘기거나 다른 회사의
  데이터와 합치지 않는다. 그래서 ATT 권한 요청도 없다.
- 제품 상호 작용만 신원과 연결되지 않는다. `click_events`에는 이벤트 이름과
  시각만 들어가고 사용자 id 컬럼이 아예 없다.

---

## 4. 심사 노트 (App Review Information)

연세대 메일로만 가입되는 구조라 **심사자가 스스로 가입할 수 없다.** 데모 계정을
적지 않으면 "로그인 불가"로 리젝된다. 아래를 그대로 넣는다 — 비밀번호는 실제 값으로
바꿔야 한다.

```
데모 계정
  이메일: steppy-master@yonsei.ac.kr
  비밀번호: <여기에 실제 비밀번호>

메모
  This app is for exchange-program students of Yonsei University (Seoul, Korea).
  Sign-up is restricted to @yonsei.ac.kr email addresses, so please use the demo
  account above. The entire UI is in Korean.

  Account deletion: tap the person icon at the top left → "회원 탈퇴" (Delete
  account) at the bottom of the sheet → confirm. This permanently deletes the
  account, all saved data and uploaded photos.

  Camera / Photos / Location are used only in the "기록하기" (Journal) tab, when
  attaching a photo to an entry. All three are optional; entries save without them.
```

> 심사가 끝나면 이 데모 계정은 지워야 한다. 앱의 "회원 탈퇴"로 지우면 된다
> (그게 정확히 심사자가 확인한 그 경로다).

---

## 5. 아직 사람이 해야 하는 일

### Supabase 대시보드 (5분)

MCP로는 인증 설정을 못 바꾼다. 웹에서 직접 눌러야 한다.

1. **Kakao provider 끄기** — Authentication → Sign In / Providers → Kakao → 비활성화.
   코드 어디서도 안 쓰는데 서버에만 켜져 있다. 켜져 있으면 anon 키로 카카오 로그인
   플로를 시작할 수 있고, `handle_new_user` 트리거가 연세대 메일이 아닌 계정을 만들려다
   실패하는 경로가 열려 있다.
   (2026-09-17 확인: `/auth/v1/settings` 응답에 `"kakao": true`)
2. **Leaked password protection 켜기** — Authentication → Policies → Password.
   Supabase 보안 권고(WARN). HaveIBeenPwned에 올라온 비밀번호를 거절한다.
3. **커스텀 SMTP 연결** — Project Settings → Authentication → SMTP.
   기본 발송기는 시간당 제한이 걸린 개발용이라 실사용자가 가입 확인 메일을 못 받는다.
   Resend 무료 플랜이면 충분하다(도메인 인증 필요).

### Apple (사용자 요청으로 이번 작업에서 제외)

- Apple Developer Program 가입(연 $99) → `DEVELOPMENT_TEAM` 설정
- 지원 URL / 개인정보처리방침 URL — `privacy.html`은 만들어 뒀다. 배포 주소가
  정해지면 `https://<도메인>/privacy.html` 을 App Store Connect에 넣으면 된다.
- TestFlight 내부 테스트

### 빌드 번호

지금 `1.0 (1)`. 첫 제출이라 그대로 올리면 된다. 같은 버전으로 두 번째 빌드를
올릴 때부터 `CURRENT_PROJECT_VERSION`을 2, 3으로 올린다
(`ios/App/App.xcodeproj/project.pbxproj`, Debug/Release 두 군데).

### 수출 규정

`ITSAppUsesNonExemptEncryption = false`를 `Info.plist`에 박아 뒀다. 빌드마다 다시
묻지 않는다. (HTTPS만 쓰고 자체 암호화 구현이 없어서 맞는 답이다.)
