# steppY에 구글 광고 붙이기 — 수익 방식 · 비용 · 등록 절차

> 2026-10 기준으로 정리. 광고 정책·지급 조건은 자주 바뀌므로 실제로 시작하기 전에
> 아래 출처의 공식 도움말을 한 번 더 확인할 것. 세금 관련 내용은 일반 정보이고,
> 실제 신고는 세무 전문가나 국세청 안내로 확인이 필요하다.

## 0. 먼저 — "Google Ads"가 아니라 "AdMob"

| 이름 | 하는 일 | steppY 입장 |
|---|---|---|
| **Google AdMob** | 앱 안에 광고를 **띄워 주고 돈을 받는** 서비스 | ✅ 우리가 쓸 것 (앱 수익) |
| Google AdSense | 웹사이트에 광고를 띄우고 돈을 받는 서비스 | 웹 버전에 광고를 붙일 때 |
| Google Ads | **돈을 내고** 우리 앱을 광고하는 서비스 | 마케팅할 때 (부록 참고) |

"앱에 광고를 넣어서 돈을 번다"는 건 **AdMob**이다. 아래는 AdMob 기준.

---

## 1. 우리가 돈을 받는 기준

### 광고비가 정해지는 방식
- 광고주들이 광고 자리를 두고 **경매(입찰)** 를 한다. 우리는 그중 낙찰된 광고를 보여주고,
  광고주가 낸 돈의 일부를 받는다.
- 광고주가 돈을 내는 기준은 캠페인마다 다르다.
  - **노출당(CPM)**: 광고가 1,000번 보일 때마다
  - **클릭당(CPC)**: 사용자가 광고를 누를 때마다
- 그래서 우리 쪽에서는 보통 **eCPM**(광고 1,000번 노출당 실제로 번 돈)으로 성과를 본다.
  가격을 우리가 정하는 게 아니라 **경매 결과로 정해진다.**

### 수익을 좌우하는 것
| 요인 | 설명 |
|---|---|
| 광고 형식 | 보상형(광고 보고 보상) · 전면 광고가 배너보다 단가가 높은 편 |
| 사용자 국가 | 광고주 경쟁이 센 국가일수록 단가가 높다 (steppY는 한국 + 파견 국가) |
| 노출 수 | 사용자 수 × 광고를 보는 횟수 |
| 채움률(fill rate) | 광고 요청 중 실제로 광고가 채워진 비율 |
| 추적 동의(ATT) | iOS에서 사용자가 추적을 거부하면 맞춤 광고가 줄어 단가가 낮아질 수 있다 |

> 구체적인 eCPM 숫자는 형식·국가·시기마다 차이가 커서 여기 적지 않았다.
> 출시 후 AdMob 대시보드의 실제 수치로 판단하는 게 정확하다.

### 수익 배분
- 광고주가 낸 돈 중 **Google이 수수료를 떼고 나머지를 우리가 받는다.**
- AdMob의 정확한 배분율은 공식 도움말에 숫자로 명시돼 있지 않고, 2차 자료에서는
  게시자 몫을 **60%대**(62%~68%)로 적고 있다. → 정확한 값은 계약 시점에 확인 필요.

### 지급
| 항목 | 내용 |
|---|---|
| 지급 기준액 | 누적 수익 **$100** 이상일 때 지급 (한국도 달러 기준) |
| 지급 시기 | 매달 **21일 전후**, 전달 수익을 지급 (예: 6월 수익 → 7월 21일경) |
| 지급 방법 | 해외 **은행 송금(wire)** 이 일반적 |
| 미달 시 | $100이 안 되면 다음 달로 이월되어 쌓인다 |

---

## 2. 우리가 내야 하는 돈

**AdMob 가입·SDK·광고 노출은 무료다.** 광고를 붙인다고 Google에 내는 돈은 없다.
대신 아래 비용·부담이 생길 수 있다.

| 항목 | 금액·내용 | 비고 |
|---|---|---|
| Apple 개발자 계정 | 연 $99 | 앱 출시에 이미 필요한 비용 (광고 때문에 새로 생기는 건 아님) |
| 해외 송금 수수료 | 은행마다 다름 | 예: 중계은행 수수료 약 $10 + 입금 수수료 약 5,000원 사례 |
| app-ads.txt 호스팅 | 0원 | 이미 쓰는 Vercel 웹사이트 루트에 파일 하나 올리면 됨 |
| 세금 | 소득에 따라 | 광고 수익은 소득 → 국내 소득세 신고 대상. 미국 세금 정보(W-8BEN 등) 미제출 시 미국 원천징수가 붙을 수 있음 — **세무 확인 필요** |
| 개발 시간 | — | SDK 연동, 동의 팝업, 개인정보처리방침 수정 |
| 사용자 경험 | — | 광고가 많으면 이탈↑ → 프리미엄의 "광고 없이" 혜택과 균형 필요 |

---

## 3. 등록 절차

### ① 계정 만들기
1. [admob.google.com](https://admob.google.com)에서 Google 계정으로 가입
2. 국가(대한민국)·시간대·결제 통화 설정, 약관 동의
3. **팀 공용 Google 계정**으로 만드는 것을 권장 (개인 계정이면 담당자가 바뀔 때 곤란)

### ② 앱 등록과 광고 단위 만들기
1. AdMob에 iOS 앱 추가 — 아직 출시 전이면 "스토어에 게시되지 않음"으로 먼저 추가 가능
2. 광고 단위 만들기 (배너 · 전면 · 보상형 · 네이티브 · 앱 오프닝 중 선택)
3. 앱 ID와 광고 단위 ID를 받는다

### ③ 앱에 연동 (개발)
- Capacitor 플러그인(`@capacitor-community/admob`)으로 붙인다
- iOS 설정(`Info.plist`): AdMob 앱 ID, SKAdNetwork 목록, 추적 권한 안내 문구
- **개발 중에는 반드시 테스트 광고 ID**를 쓴다 — 실제 광고를 우리가 반복해서 보거나 누르면
  무효 트래픽으로 계정이 정지될 수 있다

### ④ 개인정보·동의
- iOS **추적 동의(ATT) 팝업** — 맞춤 광고를 쓰려면 필요
- **동의 관리(UMP) 메시지** 설정 — 유럽 등 일부 지역 사용자에게 동의를 받아야 함
  (steppY는 유럽 파견 학생도 쓰므로 해당될 수 있음)
- `privacy.html`(개인정보처리방침)에 광고·광고 식별자 사용 내용 추가
- App Store Connect의 **개인정보 라벨**에 광고 관련 데이터 수집 항목 갱신

### ⑤ app-ads.txt 올리기
- AdMob이 알려주는 한 줄을 `app-ads.txt` 파일로 만들어 **개발자 웹사이트 루트**에 올린다
  (App Store에 등록한 웹사이트 주소와 같은 도메인이어야 함)
- 2025년부터 새로 등록하는 앱은 이 파일 확인을 통과해야 광고가 정상 노출된다

### ⑥ 출시 후 앱 연결 → 검토
1. App Store에 출시되면 AdMob에서 앱을 스토어와 연결
2. **앱 준비 상태 검토** (보통 2~3일, 더 걸릴 수도 있음)
3. 검토 전·미출시 상태에서는 광고가 **제한적으로만** 나온다

### ⑦ 지급 설정
1. 수익이 일정 금액(약 $10)에 도달하면 **주소 확인용 PIN이 우편으로** 온다 → AdMob에 입력
2. 세금 정보 제출, 신원 확인
3. 지급 수단(은행 계좌, 해외 송금 정보) 등록
4. 이후 매달 21일 전후 지급 ($100 이상일 때)

---

## 4. steppY에 맞춰 생각해 볼 점

- **프리미엄과의 관계**: BM에서 프리미엄 혜택으로 "광고 없이"를 이미 넣어 뒀다. 광고는
  무료 사용자에게만 보여주는 구조가 자연스럽다.
- **보상형 광고 + 크레딧**: "광고 보고 크레딧 받기"(예: 광고 1회 = 크레딧 N개)는 기존
  크레딧 경제와 잘 맞는다. 단, 크레딧 지급은 지금처럼 서버에서 처리해야 악용을 막는다.
- **광고 위치**: 정보 확인이 핵심인 화면(체크리스트·학점 인정)보다는 목록 화면 하단 배너나
  보상형처럼 사용자가 선택하는 방식이 덜 거슬린다.
- **결제 방식과 별개**: 광고 수익은 Apple 인앱결제 수수료와 무관하다 (광고는 Google에서 따로 지급).

---

## 부록 — 반대로 "Google Ads로 steppY를 광고"하려면

- 우리가 **돈을 내는** 쪽. 클릭당(CPC) 또는 설치·전환당으로 과금되고, 하루 예산을 정할 수 있다.
- 앱 설치 캠페인(App campaign)으로 App Store 앱을 홍보할 수 있다.
- 수익 구조가 아니라 마케팅 비용이므로, 필요하면 따로 정리.

---

## 출처
- [Getting started FAQs — Google AdMob Help](https://support.google.com/admob/answer/6168758?hl=en)
- [Payments and transactions — Google AdMob Help](https://support.google.com/admob/answer/2772140?hl=en)
- [About app readiness — Google AdMob Help](https://support.google.com/admob/answer/10564477?hl=en)
- [Set up an app in AdMob — Google AdMob Help](https://support.google.com/admob/answer/9989980?hl=en)
- [Ad serving limits — Google AdMob Help](https://support.google.com/admob/answer/9493252?hl=en)
- [Payment thresholds — Google AdSense Help](https://support.google.com/adsense/answer/1709871?hl=en)
- [New AdMob policy requires app-ads.txt from January 2025 (PPC Land)](https://ppc.land/new-admob-policy-requires-app-ads-txt-from-january-2025/)
- [Google Ads payment — a guide for publishers using AdMob (optAd360)](https://optad360.com/blog/google-ads-payment-a-guide-for-publishers/)
- [What is AdMob? (Playwire)](https://www.playwire.com/blog/what-is-admob-a-publishers-complete-platform-overview)
- [Google AdSense — NamuWiki](https://en.namu.wiki/w/%EA%B5%AC%EA%B8%80%20%EC%95%A0%EB%93%9C%EC%84%BC%EC%8A%A4)
