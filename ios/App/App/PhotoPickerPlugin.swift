import UIKit
import Capacitor
import CoreLocation
import Photos
import PhotosUI
import UniformTypeIdentifiers

/// 기록하기에서 사진을 고르는 네이티브 창 (js/diary-view.js 가 부른다).
///
/// 왜 웹의 <input type="file"> 대신 이걸 쓰나
///   웹 사진 창으로 고르면 iOS가 개인정보 보호를 위해 촬영 위치(GPS)를 지우고 넘겨준다
///   (iOS 버전·사진 창의 "옵션 → 위치" 설정에 따라 다르다). 그러면 사진을 찍은 곳으로
///   기록할 수 없다. 여기서는 사진 보관함 권한을 받아 사진 앱에 저장된 촬영 위치·시각을
///   PHAsset에서 직접 읽어서, 파일과 함께 넘긴다.
///
/// 권한
///   처음 부를 때 사진 보관함 접근을 묻는다(Info.plist NSPhotoLibraryUsageDescription).
///   거부하거나 "선택한 사진만" 허용해도 사진은 그대로 고를 수 있다 — PHPicker는 권한 없이
///   동작한다. 그때는 보관함에서 위치를 못 읽으니 파일 안에 남은 정보만 쓴다(없으면 위치 없음).
///
/// 실시간 위치는 쓰지 않는다. 읽는 건 이미 찍혀 있는 사진의 촬영 위치뿐이다.
///
/// pick({ limit }) → { photos: [{ path, name, mimeType, takenAt?, location?: { lat, lng } }] }
///   path 는 임시 폴더에 복사한 파일(file://). JS에서 Capacitor.convertFileSrc 로 읽는다.
///   limit 0 이면 개수 제한 없음. 취소하면 photos: [].
@objc(PhotoPickerPlugin)
class PhotoPickerPlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate {
    let identifier = "PhotoPickerPlugin"
    let jsName = "PhotoPicker"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pick", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?

    @objc func pick(_ call: CAPPluginCall) {
        let limit = max(0, call.getInt("limit") ?? 0)
        requestAccessIfNeeded {
            DispatchQueue.main.async { self.presentPicker(call, limit: limit) }
        }
    }

    /// 고른 사진이 없을 때 돌려줄 값. 빈 배열 리터럴([])은 [String: Any] 안에서 타입을 못 정해 컴파일 오류가 난다.
    private static let noPhotos: [String: Any] = ["photos": [JSObject]()]

    /// 아직 묻지 않았을 때만 묻는다. 결과와 상관없이 사진 창은 연다.
    private func requestAccessIfNeeded(_ done: @escaping () -> Void) {
        if PHPhotoLibrary.authorizationStatus(for: .readWrite) == .notDetermined {
            PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in done() }
        } else {
            done()
        }
    }

    private func presentPicker(_ call: CAPPluginCall, limit: Int) {
        guard var host = bridge?.viewController else { call.reject("no view controller"); return }
        // 다른 창(시트 등)이 떠 있으면 그 위에 띄운다 — 아래 화면에서 present 하면 아무것도 안 뜬다
        while let presented = host.presentedViewController { host = presented }

        if let old = pendingCall {
            // 사진 창이 아직 떠 있으면 두 번째 요청은 받지 않는다
            if host is PHPickerViewController { call.reject("already picking"); return }
            // 창은 닫혔는데 응답을 못 받은 요청이 남아 있으면 빈 결과로 끝내 준다(JS가 영영 기다리지 않게)
            old.resolve(Self.noPhotos)
            pendingCall = nil
        }

        // .shared() 로 열어야 고른 사진의 assetIdentifier 가 온다(그걸로 PHAsset을 찾는다)
        var config = PHPickerConfiguration(photoLibrary: .shared())
        config.filter = .images
        config.selectionLimit = limit
        // HEIC는 JPEG로 바꿔 받는다 — 웹뷰·업로드 쪽이 JPEG를 가장 잘 다룬다
        config.preferredAssetRepresentationMode = .compatible

        let picker = PHPickerViewController(configuration: config)
        picker.delegate = self
        // 아래로 쓸어 닫으면 didFinishPicking 이 안 불릴 수 있다 — 취소 버튼으로만 닫게 한다
        picker.isModalInPresentation = true
        pendingCall = call
        host.present(picker, animated: true)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let call = pendingCall else { return }
        pendingCall = nil
        if results.isEmpty { call.resolve(Self.noPhotos); return }

        // 촬영 위치·시각 — 보관함 권한이 있을 때만 PHAsset 에서 읽힌다
        // ("선택한 사진만" 허용이면 그 목록에 든 사진만 찾아진다)
        var assets: [String: PHAsset] = [:]
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        let ids = results.compactMap { $0.assetIdentifier }
        if (status == .authorized || status == .limited) && !ids.isEmpty {
            PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil)
                .enumerateObjects { asset, _, _ in assets[asset.localIdentifier] = asset }
        }
        let assetsById = assets   // 아래 비동기 블록에서는 읽기만 한다

        let iso = ISO8601DateFormatter()
        let lock = NSLock()
        let group = DispatchGroup()
        var photos = [JSObject?](repeating: nil, count: results.count)

        for (index, result) in results.enumerated() {
            let provider = result.itemProvider
            let typeId = provider.hasItemConformingToTypeIdentifier(UTType.jpeg.identifier)
                ? UTType.jpeg.identifier
                : UTType.image.identifier
            group.enter()
            // 넘겨받은 url 은 이 블록이 끝나면 지워진다 — 안에서 바로 복사한다
            provider.loadFileRepresentation(forTypeIdentifier: typeId) { url, _ in
                defer { group.leave() }
                guard let url = url else { return }
                let ext = url.pathExtension.isEmpty ? "jpg" : url.pathExtension.lowercased()
                let dest = FileManager.default.temporaryDirectory
                    .appendingPathComponent("steppy-pick-\(UUID().uuidString).\(ext)")
                do { try FileManager.default.copyItem(at: url, to: dest) } catch { return }

                var photo: JSObject = [
                    "path": dest.absoluteString,
                    "name": url.lastPathComponent,
                    "mimeType": UTType(filenameExtension: ext)?.preferredMIMEType ?? "image/jpeg"
                ]
                if let id = result.assetIdentifier, let asset = assetsById[id] {
                    if let location = asset.location, CLLocationCoordinate2DIsValid(location.coordinate) {
                        let coords: JSObject = [
                            "lat": location.coordinate.latitude,
                            "lng": location.coordinate.longitude
                        ]
                        photo["location"] = coords
                    }
                    if let date = asset.creationDate {
                        photo["takenAt"] = iso.string(from: date)
                    }
                }
                lock.lock()
                photos[index] = photo
                lock.unlock()
            }
        }

        // 고른 순서를 지켜서 넘긴다(못 읽은 사진은 빠진다)
        group.notify(queue: .main) {
            call.resolve(["photos": photos.compactMap { $0 }])
        }
    }
}
