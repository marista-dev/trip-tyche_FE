/*
 * 앱 버전. android/app/build.gradle의 versionName과 **반드시 같아야 한다.**
 *
 * 두 곳에 있는 이유: 네이티브 빌드 설정(gradle)과 웹 번들(JS)이 서로를 읽을 수 없기 때문이다.
 * 배포할 때 gradle의 versionCode·versionName과 이 값을 함께 올린다.
 * scripts/build-release-apk.sh가 빌드 끝에 gradle 버전을 출력하므로 대조할 수 있다.
 */
export const APP_VERSION_NAME = '1.0.0';
