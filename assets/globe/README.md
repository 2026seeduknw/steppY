# 지구 텍스처

`earth-equirect.webp` — NASA Visible Earth "Blue Marble: Land Surface, Shallow Water,
and Shaded Topography" 를 1024×512 로 줄인 것.
원본: https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_2048.jpg
NASA 이미지는 퍼블릭 도메인이다(별도 허락·표기 의무 없음).

정사각도법(equirectangular) 한 장이라, js/globe.js 가 이걸 구면에 입혀
정사영(orthographic)으로 그린다 — 경도만 계속 돌리면 진짜 자전이 된다.

예전에는 각도가 다른 사진 5컷을 겹쳐 넘겼는데, 5컷으로는 회전이 아니라
디졸브로 보였다. 그 사진들은 `tools/globe-frames/` 로 옮겨 뒀다 — 참고용이고,
assets/ 에 두면 안 쓰는 250KB 가 앱 번들에 그대로 실린다.
