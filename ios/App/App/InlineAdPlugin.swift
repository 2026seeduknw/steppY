import UIKit
import Capacitor
import GoogleMobileAds

/// 배너 바깥을 누르면 아래 웹뷰로 그대로 통과시킨다.
private class PassthroughView: UIView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        return hit === self ? nil : hit
    }
}

/// 본문 안 한 자리에 붙어 스크롤과 함께 움직이는 AdMob 배너 (js/ads.js가 부른다).
///
/// @capacitor-community/admob의 배너는 화면 위·아래에 고정으로만 뜬다. 여기서는
/// 웹 문서 안의 자리(ad-slot)를 좌표로 받아 그 위에 배너를 얹고, 웹뷰가 스크롤될
/// 때마다 같은 만큼 옮긴다. 앱바 아래 ~ 탭바 위 구간 밖으로 나간 부분은 잘라내서
/// 광고가 앱바·탭바를 덮지 않게 한다(탭을 누르려다 광고를 누르면 안 된다).
@objc(InlineAdPlugin)
class InlineAdPlugin: CAPPlugin, CAPBridgedPlugin, BannerViewDelegate {
    let identifier = "InlineAdPlugin"
    let jsName = "InlineAd"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise)
    ]

    private var clip: PassthroughView?
    private var banner: BannerView?
    private var loaded = false
    private var origin = CGPoint.zero   // 문서 좌표(스크롤 0 기준)
    private var offsetObservation: NSKeyValueObservation?

    /// show({ adId, x, y, width, clipTop, clipBottom }) — y는 문서 좌표, clip*은 화면 좌표.
    /// 이미 같은 광고가 떠 있으면 새로 요청하지 않고 자리만 옮긴다.
    @objc func show(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView else { call.reject("no webview"); return }
            let adId = call.getString("adId") ?? ""
            let width = CGFloat(call.getDouble("width") ?? Double(webView.bounds.width))
            let clipTop = CGFloat(call.getDouble("clipTop") ?? 0)
            let clipBottom = CGFloat(call.getDouble("clipBottom") ?? Double(webView.bounds.height))
            self.origin = CGPoint(x: CGFloat(call.getDouble("x") ?? 0), y: CGFloat(call.getDouble("y") ?? 0))

            let clip = self.clip ?? {
                let view = PassthroughView()
                view.clipsToBounds = true
                webView.addSubview(view)
                self.clip = view
                return view
            }()
            clip.frame = CGRect(x: 0, y: clipTop, width: webView.bounds.width, height: max(0, clipBottom - clipTop))
            clip.isHidden = false

            if self.banner == nil || self.banner?.adUnitID != adId || abs((self.banner?.frame.width ?? 0) - width) > 0.5 {
                self.banner?.removeFromSuperview()
                let size = currentOrientationAnchoredAdaptiveBanner(width: width)
                let banner = BannerView(adSize: size)
                banner.frame.size = size.size
                banner.adUnitID = adId
                banner.rootViewController = self.bridge?.viewController
                banner.delegate = self
                banner.isHidden = true
                clip.addSubview(banner)
                self.banner = banner
                self.loaded = false
                banner.load(Request())
            }

            if self.offsetObservation == nil {
                self.offsetObservation = webView.scrollView.observe(\.contentOffset) { [weak self] _, _ in
                    self?.layout()
                }
            }
            self.layout()
            call.resolve(["height": self.loaded ? Double(self.banner?.frame.height ?? 0) : 0])
        }
    }

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.clip?.isHidden = true
            call.resolve()
        }
    }

    private func layout() {
        guard let webView = bridge?.webView, let clip = clip, let banner = banner else { return }
        let offset = webView.scrollView.contentOffset
        banner.frame.origin = CGPoint(x: origin.x - offset.x, y: origin.y - offset.y - clip.frame.minY)
    }

    func bannerViewDidReceiveAd(_ bannerView: BannerView) {
        loaded = true
        bannerView.isHidden = false
        notifyListeners("loaded", data: ["height": Double(bannerView.frame.height)])
    }

    func bannerView(_ bannerView: BannerView, didFailToReceiveAdWithError error: Error) {
        NSLog("InlineAd: failed to load — \(error.localizedDescription)")
    }
}

/// 앱 안에 둔 플러그인은 npm 패키지가 아니라 자동으로 잡히지 않는다 — 여기서 직접 등록한다.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(InlineAdPlugin())
    }
}
