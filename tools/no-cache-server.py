"""
python3 -m http.server의 문제: Last-Modified만 보내고 Cache-Control은 안 보내서,
브라우저가 파일을 수정해도 이전 버전을 계속 재사용하는 경우가 잦음(휴리스틱 캐싱).
이 스크립트는 동일한 정적 서버에 모든 응답에 no-store를 강제로 붙여서
편집 중 새로고침하면 항상 최신 파일이 보이게 한다.

사용법: python3 tools/no-cache-server.py <port>
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    http.server.test(HandlerClass=NoCacheHandler, port=port)
