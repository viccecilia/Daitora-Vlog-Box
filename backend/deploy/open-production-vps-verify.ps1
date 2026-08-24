$dvKey = Join-Path $env:USERPROFILE ".ssh\tourflow_sakura_vps_ed25519"
$Host.UI.RawUI.WindowTitle = "Daitora Vlog Box - Production"

Write-Host "Daitora Vlog Box - VPS backend verification" -ForegroundColor Cyan
Write-Host "Target: 133.167.79.170"
Write-Host "Scope: backend health, api-vlog Nginx/certificate checks, and removal of the inactive misplaced Web copy."
Write-Host "This does NOT request a certificate for vlog.daitora-jp.com and does NOT change DNS."
Write-Host "Password input is hidden and will never be displayed."
Write-Host ""
Read-Host "Press Enter to start the secure SSH session"

try {
    & ssh -tt -i $dvKey ubuntu@133.167.79.170 "bash -lc 'rm -f /home/ubuntu/daitora-vlog-release/vps-verify.ok /home/ubuntu/daitora-vlog-release/vps-verify.failed; if sudo -p VPS-sudo-password: bash /home/ubuntu/daitora-vlog-release/backend/deploy/production-vps-verify-cleanup.sh; then touch /home/ubuntu/daitora-vlog-release/vps-verify.ok; echo VPS-VERIFY-SUCCEEDED; else touch /home/ubuntu/daitora-vlog-release/vps-verify.failed; echo VPS-VERIFY-FAILED; fi'"
    Write-Host "SSH exit code: $LASTEXITCODE"
} catch {
    Write-Host "Unable to launch SSH: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Read-Host "Command finished. Press Enter to close this window"
