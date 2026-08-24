$dvKey = Join-Path $env:USERPROFILE ".ssh\tourflow_sakura_vps_ed25519"
$Host.UI.RawUI.WindowTitle = "Daitora Vlog Box - Production Activation"
Write-Host "Daitora Vlog Box production activation" -ForegroundColor Cyan
Write-Host "This window will connect to the VPS and request the sudo password."
Write-Host "Password input is hidden and will never be displayed."
Write-Host "Keep this window open until ACTIVATION-SUCCEEDED or ACTIVATION-FAILED appears."
Write-Host ""
Read-Host "Press Enter to start the secure SSH session"
try {
    & ssh -tt -i $dvKey ubuntu@133.167.79.170 "bash -lc 'rm -f /home/ubuntu/daitora-vlog-release/activation.ok /home/ubuntu/daitora-vlog-release/activation.failed; if sudo -p VPS-sudo-password: bash /home/ubuntu/daitora-vlog-release/backend/deploy/production-activate.sh; then touch /home/ubuntu/daitora-vlog-release/activation.ok; echo ACTIVATION-SUCCEEDED; else touch /home/ubuntu/daitora-vlog-release/activation.failed; echo ACTIVATION-FAILED; fi'"
    Write-Host "SSH exit code: $LASTEXITCODE"
} catch {
    Write-Host "Unable to launch SSH: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Command finished. Press Enter to close this window"
