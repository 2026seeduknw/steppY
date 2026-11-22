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
