use serde::Deserialize;
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_notification::NotificationExt;

const UPDATE_ENDPOINT: &str = "https://teamcanvas.pages.dev/downloads/latest.json";
const AUTO_CHECK_INTERVAL_SECS: u64 = 24 * 60 * 60;

#[derive(Debug, Deserialize)]
pub struct LatestManifest {
    pub version: String,
    #[serde(default)]
    pub notes: String,
    pub url: String,
}

#[derive(Debug)]
pub enum UpdateCheckOutcome {
    UpToDate,
    Available(LatestManifest),
    Failed(String),
}

fn current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

fn parse_semver(v: &str) -> Option<(u64, u64, u64)> {
    let mut parts = v.trim().trim_start_matches('v').split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    Some((major, minor, patch))
}

fn is_newer(remote: &str, local: &str) -> bool {
    match (parse_semver(remote), parse_semver(local)) {
        (Some(r), Some(l)) => r > l,
        _ => remote.trim() != local.trim(),
    }
}

fn last_check_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join("last_update_check.txt"))
}

fn should_auto_check(app: &AppHandle) -> bool {
    let Some(path) = last_check_path(app) else {
        return true;
    };
    let Ok(content) = std::fs::read_to_string(&path) else {
        return true;
    };
    let Ok(last) = content.trim().parse::<u64>() else {
        return true;
    };
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    now.saturating_sub(last) >= AUTO_CHECK_INTERVAL_SECS
}

fn mark_checked(app: &AppHandle) {
    let Some(path) = last_check_path(app) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let _ = std::fs::write(path, now.to_string());
}

pub fn fetch_latest() -> Result<LatestManifest, String> {
    let response = ureq::get(UPDATE_ENDPOINT)
        .timeout(Duration::from_secs(15))
        .call()
        .map_err(|e| format!("업데이트 정보를 가져오지 못했습니다: {e}"))?;

    response
        .into_json::<LatestManifest>()
        .map_err(|e| format!("업데이트 정보 형식이 올바르지 않습니다: {e}"))
}

pub fn check_for_update() -> UpdateCheckOutcome {
    match fetch_latest() {
        Ok(manifest) => {
            if is_newer(&manifest.version, current_version()) {
                UpdateCheckOutcome::Available(manifest)
            } else {
                UpdateCheckOutcome::UpToDate
            }
        }
        Err(err) => UpdateCheckOutcome::Failed(err),
    }
}

fn download_installer(url: &str) -> Result<PathBuf, String> {
    let response = ureq::get(url)
        .timeout(Duration::from_secs(180))
        .call()
        .map_err(|e| format!("설치 파일 다운로드 실패: {e}"))?;

    let temp = std::env::temp_dir().join(format!(
        "TeamCanvas-Setup-{}.exe",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    ));

    let mut file =
        File::create(&temp).map_err(|e| format!("임시 파일 생성 실패: {e}"))?;
    let mut reader = response.into_reader();
    std::io::copy(&mut reader, &mut file).map_err(|e| format!("파일 저장 실패: {e}"))?;
    file.flush().ok();
    Ok(temp)
}

fn run_installer_and_exit(app: &AppHandle, installer: PathBuf) {
    match std::process::Command::new(&installer).spawn() {
        Ok(_) => {
            app.exit(0);
        }
        Err(err) => {
            app.dialog()
                .message(format!(
                    "설치 프로그램을 실행하지 못했습니다.\n{err}\n\n파일을 직접 실행해 주세요:\n{}",
                    installer.display()
                ))
                .kind(MessageDialogKind::Error)
                .title("업데이트 실패")
                .blocking_show();
        }
    }
}

fn prompt_and_install(app: &AppHandle, manifest: &LatestManifest) {
    let notes = if manifest.notes.trim().is_empty() {
        String::new()
    } else {
        format!("\n\n{}", manifest.notes.trim())
    };

    let accepted = app
        .dialog()
        .message(format!(
            "새 버전 TeamCanvas {} 이(가) 있습니다.\n현재 버전: {}{}\n\n지금 다운로드하고 설치할까요?",
            manifest.version,
            current_version(),
            notes
        ))
        .kind(MessageDialogKind::Info)
        .title("업데이트 알림")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "업데이트".into(),
            "나중에".into(),
        ))
        .blocking_show();

    if !accepted {
        return;
    }

    app.dialog()
        .message("설치 파일을 다운로드하는 동안 잠시만 기다려 주세요.")
        .kind(MessageDialogKind::Info)
        .title("업데이트")
        .blocking_show();

    match download_installer(&manifest.url) {
        Ok(path) => run_installer_and_exit(app, path),
        Err(err) => {
            app.dialog()
                .message(err)
                .kind(MessageDialogKind::Error)
                .title("업데이트 실패")
                .blocking_show();
        }
    }
}

fn notify_available(app: &AppHandle, version: &str) {
    let _ = app
        .notification()
        .builder()
        .title("TeamCanvas 업데이트")
        .body(format!("새 버전 {version} 을(를) 설치할 수 있습니다."))
        .show();
}

/// 시작 시 자동 확인 (하루 1회)
pub fn maybe_auto_check(app: AppHandle) {
    if !should_auto_check(&app) {
        return;
    }
    mark_checked(&app);

    match check_for_update() {
        UpdateCheckOutcome::Available(manifest) => {
            notify_available(&app, &manifest.version);
            show_main_if_hidden(&app);
            prompt_and_install(&app, &manifest);
        }
        UpdateCheckOutcome::UpToDate | UpdateCheckOutcome::Failed(_) => {}
    }
}

/// 트레이 메뉴 수동 확인
pub fn manual_check(app: &AppHandle) {
    mark_checked(app);

    match check_for_update() {
        UpdateCheckOutcome::Available(manifest) => {
            notify_available(app, &manifest.version);
            show_main_if_hidden(app);
            prompt_and_install(app, &manifest);
        }
        UpdateCheckOutcome::UpToDate => {
            app.dialog()
                .message(format!(
                    "최신 버전을 사용 중입니다.\n현재 버전: {}",
                    current_version()
                ))
                .kind(MessageDialogKind::Info)
                .title("업데이트 확인")
                .blocking_show();
        }
        UpdateCheckOutcome::Failed(err) => {
            app.dialog()
                .message(err)
                .kind(MessageDialogKind::Error)
                .title("업데이트 확인 실패")
                .blocking_show();
        }
    }
}

fn show_main_if_hidden(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_semver() {
        assert!(is_newer("0.1.1", "0.1.0"));
        assert!(!is_newer("0.1.0", "0.1.1"));
        assert!(!is_newer("0.1.1", "0.1.1"));
    }
}
