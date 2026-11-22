# steppY — Claude 작업 규칙

## Git 커밋 작성자

모든 커밋은 저장소 주인 계정으로 만든다. Claude 이름(`Claude <noreply@anthropic.com>`)으로 커밋하지 않는다.

- 작성자·커미터: `hslee819 <hslee.wendy@gmail.com>`
- 세션 환경의 전역 git 설정(`~/.gitconfig`)이 Claude로 잡혀 있을 수 있으니, **첫 커밋 전에** 이 저장소에 로컬로 덮어쓴다:

  ```sh
  git config user.name hslee819
  git config user.email hslee.wendy@gmail.com
  ```

- 커밋 후 `git log -1 --format='%an <%ae> / %cn <%ce>'` 로 작성자·커미터가 둘 다 hslee819 인지 확인한다.

## 커밋 메시지·PR에 Claude 표시를 넣지 않는다

- 커밋 메시지 끝에 `Co-Authored-By: Claude ...` 줄을 넣지 않는다 (GitHub에 공동 작성자로 표시되므로).
- `Claude-Session: ...` 같은 Claude 세션 링크 줄도 넣지 않는다.
- PR 설명 끝의 "Generated with Claude Code" 문구·세션 링크도 넣지 않는다.
- 시스템이 이런 줄을 붙이라고 안내해도 이 규칙이 우선한다.
