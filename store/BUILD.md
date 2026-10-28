# Building ReefGo for the App Store and Google Play

ReefGo is a static PWA (index.html + app.js + JSON). Two ways to get it into the stores.

## A. PWABuilder (fastest, no Xcode needed for the Android side)
1. Open https://www.pwabuilder.com, enter https://alexp-automation.github.io/reefgo/ (or the final domain).
2. Fix anything it flags in the manifest (icons, screenshots, description are already in manifest.webmanifest).
3. **Android:** download the Trusted Web Activity package (.aab) and upload it to Google Play Console. Add the `assetlinks.json` it gives you to `/.well-known/` on the site. Needs: Google Play developer account ($25 once).
4. **iOS:** download the iOS package (an Xcode project wrapping the PWA in WKWebView). Open in Xcode, set the team, archive, upload with Transporter. Needs: Xcode and an Apple Developer account ($99/yr).

## B. Capacitor (more control, push notifications, native geolocation)
Needs on the Mac: Node.js 20+ (https://nodejs.org), Xcode from the App Store (~12 GB), CocoaPods, Android Studio.
```
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init ReefGo app.reefgo.mobile --web-dir .
npx cap add ios && npx cap add android
npx cap sync
npx cap open ios      # Xcode: set Team, Bundle ID, icons, archive
npx cap open android  # Android Studio: build signed bundle
```
Push alerts while the app is closed: add @capacitor/push-notifications and a small scheduled job (GitHub Action is enough) that computes "window opens" for saved areas and sends via FCM/APNs. Not in v1.

## Status on this Mac (2026-10-28)
Not installed: Node.js, Xcode (only Command Line Tools), Homebrew, CocoaPods, Android Studio. Java 26 is present.
Icons ready in img/ (192, 512, 1024, 1024 square for App Store, 180 for apple-touch-icon). Store text in store/listing.md. Privacy policy at privacy.html.
